"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { callLLM, parseJSONResponse, generateImage, MODELS } from "./llm";
import {
    IMAGE_GENERATION_PROMPT,
    POST_TYPE_PROMPTS,
} from "./prompts";
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

// Simplified post generation - no creative angles required
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

        // 5. Get brand analysis (optional - for enhanced context if available)
        const brandAnalysis = await ctx.runQuery(api.ai.analysisMutations.getLatestAnalysis, {
            projectId: args.projectId,
        });

        // 6. Get user-uploaded reference images
        const referenceImages = await ctx.runQuery(api.referenceImages.listByProject, {
            projectId: args.projectId,
        });

        // 7. Build context for caption generation
        const postTypePrompt = POST_TYPE_PROMPTS[args.brief.postType as PostType] || POST_TYPE_PROMPTS.conteudo_profissional;
        
        const lengthGuideline = {
            curta: '50-100 caracteres (sem hashtags) - direto ao ponto',
            media: '100-200 caracteres (sem hashtags) - desenvolvimento moderado',
            longa: '200-350 caracteres (sem hashtags) - storytelling completo',
        }[args.brief.captionLength || 'media'];

        // Build caption generation prompt
        const captionPrompt = `Crie uma legenda de Instagram para a marca "${project.name}".

## Contexto da Marca
${brandAnalysis?.brandVoice ? `- Voz da marca: ${brandAnalysis.brandVoice.recommended}` : ''}
${brandAnalysis?.brandVoice?.tone ? `- Tom: ${args.brief.toneOverride?.join(', ') || brandAnalysis.brandVoice.tone.join(', ')}` : ''}
${brandAnalysis?.targetAudience?.recommended ? `- Público-alvo: ${brandAnalysis.targetAudience.recommended}` : ''}
${brandAnalysis?.businessCategory ? `- Categoria: ${brandAnalysis.businessCategory}` : ''}

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

## Formato de Resposta (JSON)
{
  "caption": "legenda completa com emojis e hashtags",
  "reasoning": "explicacao breve das escolhas criativas"
}

IMPORTANTE: Responda APENAS com o objeto JSON, sem markdown.`;

        // 8. Generate caption
        const response = await callLLM(
            [
                { role: "system", content: "Voce e um especialista em conteudo para Instagram. Crie legendas envolventes e autenticticas. Responda apenas com JSON valido." },
                { role: "user", content: captionPrompt },
            ],
            {
                model: MODELS.GPT_4_1,
                temperature: 0.8,
                maxTokens: 1024,
            }
        );

        const generated = parseJSONResponse<{ caption: string; reasoning: string }>(response.content);

        // 9. Collect reference images for image generation
        const referenceImageUrls: Array<{ url: string }> = [];
        for (const img of referenceImages) {
            if (img.url) {
                referenceImageUrls.push({ url: img.url });
            }
        }

        // 10. Generate image
        const imagePrompt = IMAGE_GENERATION_PROMPT({
            brandName: project.name,
            visualStyle: brandAnalysis?.visualDirection?.recommendedStyle ?? "Moderno e profissional",
            caption: generated.caption,
            additionalContext: args.brief.additionalContext,
            hasReferenceImages: referenceImageUrls.length > 0,
            businessCategory: brandAnalysis?.businessCategory,
            postType: args.brief.postType as PostType,
        });

        let imageStorageId: Id<"_storage"> | undefined;
        try {
            const imageResult = await generateImage(imagePrompt, {
                referenceImages: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
            });

            const binaryData = Uint8Array.from(atob(imageResult.imageBase64), (c) => c.charCodeAt(0));
            const blob = new Blob([binaryData], { type: imageResult.mimeType });
            imageStorageId = await ctx.storage.store(blob);
        } catch (imageError) {
            console.error("Image generation failed:", imageError);
        }

        // 11. Store generated post
        const generatedPostId = await ctx.runMutation(api.generatedPosts.create, {
            projectId: args.projectId,
            caption: generated.caption,
            brandAnalysisId: brandAnalysis?._id,
            reasoning: generated.reasoning,
            model: MODELS.GPT_4_1,
            imageStorageId,
            imagePrompt: imageStorageId ? imagePrompt : undefined,
            imageModel: imageStorageId ? MODELS.GEMINI_3_PRO_IMAGE : undefined,
            brief: {
                postType: args.brief.postType,
                contentPillar: args.brief.contentPillar,
                customTopic: args.brief.customTopic,
                toneOverride: args.brief.toneOverride,
                captionLength: args.brief.captionLength,
                includeHashtags: args.brief.includeHashtags,
                additionalContext: args.brief.additionalContext,
                referenceText: args.brief.referenceText,
            },
        });

        // 12. Consume prompts
        await ctx.runMutation(api.billing.usage.consumePrompt, { count: imageStorageId ? 2 : 1 });

        return { success: true, generatedPostId };
    },
});
