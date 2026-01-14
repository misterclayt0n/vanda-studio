"use node";

import { Effect } from "effect";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
    TextGeneration,
    ImageGeneration,
    MODELS,
    runAiEffectOrThrow,
} from "./llm/index";
import { IMAGE_GENERATION_PROMPT, POST_TYPE_PROMPTS } from "./prompts";
import type { PostType } from "./prompts";

// Brief input type
const briefValidator = v.object({
    postType: v.string(),
    contentPillar: v.optional(v.string()),
    customTopic: v.optional(v.string()),
    toneOverride: v.optional(v.array(v.string())),
    captionLength: v.optional(v.union(
        v.literal("curta"),
        v.literal("media"),
        v.literal("longa")
    )),
    includeHashtags: v.optional(v.boolean()),
    additionalContext: v.optional(v.string()),
    referenceText: v.optional(v.string()),
});

// Simplified post generation - no brand analysis required
export const generatePost = action({
    args: {
        projectId: v.id("projects"),
        brief: briefValidator,
    },
    handler: async (ctx, args): Promise<{
        success: boolean;
        generatedPostId: Id<"generated_posts">;
    }> => {
        // 1. Check authentication
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // 2. Ensure subscription exists
        await ctx.runMutation(api.billing.usage.ensureSubscription, {});

        // 3. Check quota (need 2 prompts: 1 for caption, 1 for image)
        const quota = await ctx.runQuery(api.billing.usage.checkQuota, {});
        if (!quota || quota.remaining < 2) {
            throw new Error(
                `Saldo insuficiente. Voce precisa de 2 creditos para gerar um post. Creditos restantes: ${quota?.remaining ?? 0}`
            );
        }

        // 4. Get project data
        const project = await ctx.runQuery(api.projects.get, { projectId: args.projectId });
        if (!project) {
            throw new Error("Project not found or access denied");
        }

        // 5. Get user-uploaded reference images
        const referenceImages = await ctx.runQuery(api.referenceImages.listByProject, {
            projectId: args.projectId,
        });

        // 6. Build context for caption generation
        const postTypePrompt = POST_TYPE_PROMPTS[args.brief.postType as PostType] || POST_TYPE_PROMPTS.conteudo_profissional;
        
        const lengthGuideline = {
            curta: '50-100 caracteres (sem hashtags) - direto ao ponto',
            media: '100-200 caracteres (sem hashtags) - desenvolvimento moderado',
            longa: '200-350 caracteres (sem hashtags) - storytelling completo',
        }[args.brief.captionLength || 'media'];

        // Build caption generation prompt
        const captionPrompt = `Crie uma legenda de Instagram para a marca "${project.name}".

## Contexto da Marca
- Nome: ${project.name}
${project.bio ? `- Bio: ${project.bio}` : ''}
${project.instagramHandle ? `- Handle: @${project.instagramHandle}` : ''}

## Tipo de Post
${postTypePrompt}

## Instrucoes do Usuario
${args.brief.additionalContext || 'Criar um post envolvente para Instagram'}

${args.brief.referenceText ? `## Material de Referencia\n"${args.brief.referenceText}"` : ''}

## Diretrizes de Formato
- Tamanho: ${lengthGuideline}
- Hashtags: ${args.brief.includeHashtags !== false ? 'Incluir 5-10 hashtags relevantes no final' : 'NAO incluir hashtags'}
- Emojis: Usar naturalmente quando apropriado
- Linguagem: Portugues brasileiro
${args.brief.toneOverride?.length ? `- Tom: ${args.brief.toneOverride.join(', ')}` : ''}

## Formato de Resposta (JSON)
{
  "caption": "legenda completa com emojis e hashtags",
  "reasoning": "explicacao breve das escolhas criativas"
}

IMPORTANTE: Responda APENAS com o objeto JSON, sem markdown.`;

        // 7. Generate caption using Effect
        const generated = await runAiEffectOrThrow(
            Effect.gen(function* () {
                const textGen = yield* TextGeneration;
                return yield* textGen.generateCaption({
                    messages: [
                        { role: "system", content: "Voce e um especialista em conteudo para Instagram. Crie legendas envolventes e autenticticas. Responda apenas com JSON valido." },
                        { role: "user", content: captionPrompt },
                    ],
                    model: MODELS.GPT_4_1,
                    temperature: 0.8,
                    maxTokens: 1024,
                });
            })
        );

        // 8. Collect reference images for image generation
        const referenceImageUrls: Array<{ url: string }> = [];
        for (const img of referenceImages) {
            if (img.url) {
                referenceImageUrls.push({ url: img.url });
            }
        }

        // 9. Generate image
        const imagePrompt = IMAGE_GENERATION_PROMPT({
            brandName: project.name,
            visualStyle: "Moderno e profissional",
            caption: generated.caption,
            ...(args.brief.additionalContext && { additionalContext: args.brief.additionalContext }),
            hasReferenceImages: referenceImageUrls.length > 0,
            postType: args.brief.postType as PostType,
        });

        let imageStorageId: Id<"_storage"> | undefined;
        try {
            const imageResult = await runAiEffectOrThrow(
                Effect.gen(function* () {
                    const imageGen = yield* ImageGeneration;
                    return yield* imageGen.generateImage({
                        prompt: imagePrompt,
                        ...(referenceImageUrls.length > 0 && { referenceImages: referenceImageUrls }),
                    });
                })
            );

            const binaryData = Uint8Array.from(atob(imageResult.imageBase64), (c) => c.charCodeAt(0));
            const blob = new Blob([binaryData], { type: imageResult.mimeType });
            imageStorageId = await ctx.storage.store(blob);
        } catch (imageError) {
            console.error("Image generation failed:", imageError);
        }

        // 10. Store generated post - use conditional spreading for optional fields
        const generatedPostId = await ctx.runMutation(api.generatedPosts.create, {
            projectId: args.projectId,
            caption: generated.caption,
            ...(generated.reasoning && { reasoning: generated.reasoning }),
            model: MODELS.GPT_4_1,
            ...(imageStorageId && { imageStorageId }),
            ...(imageStorageId && { imagePrompt }),
            ...(imageStorageId && { imageModel: MODELS.GEMINI_3_PRO_IMAGE }),
            brief: {
                postType: args.brief.postType,
                ...(args.brief.contentPillar && { contentPillar: args.brief.contentPillar }),
                ...(args.brief.customTopic && { customTopic: args.brief.customTopic }),
                ...(args.brief.toneOverride && { toneOverride: args.brief.toneOverride }),
                ...(args.brief.captionLength && { captionLength: args.brief.captionLength }),
                ...(args.brief.includeHashtags !== undefined && { includeHashtags: args.brief.includeHashtags }),
                ...(args.brief.additionalContext && { additionalContext: args.brief.additionalContext }),
                ...(args.brief.referenceText && { referenceText: args.brief.referenceText }),
            },
        });

        // 11. Consume prompts
        await ctx.runMutation(api.billing.usage.consumePrompt, { count: imageStorageId ? 2 : 1 });

        return { success: true, generatedPostId };
    },
});
