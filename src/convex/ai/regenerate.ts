"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { callLLM, parseJSONResponse, generateImage, MODELS } from "./llm";
import { IMAGE_GENERATION_PROMPT } from "./prompts";
import type { PostType } from "./prompts";

// Regenerate just the image with optional feedback
export const regenerateImage = action({
    args: {
        generatedPostId: v.id("generated_posts"),
        feedback: v.optional(v.string()), // User feedback like "make it brighter", "more product focus"
    },
    handler: async (ctx, args): Promise<{ success: boolean; imageUrl: string | null }> => {
        // 1. Check authentication
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // 2. Check quota
        const quota = await ctx.runQuery(api.billing.usage.checkQuota, {});
        if (!quota || quota.remaining < 1) {
            throw new Error(
                `Creditos insuficientes. Voce precisa de 1 credito para regenerar a imagem. Creditos restantes: ${quota?.remaining ?? 0}`
            );
        }

        // 3. Get the generated post
        const post = await ctx.runQuery(api.generatedPosts.get, { id: args.generatedPostId });
        if (!post) {
            throw new Error("Post not found");
        }

        // 4. Get project info
        const project = await ctx.runQuery(api.projects.get, { projectId: post.projectId });
        if (!project) {
            throw new Error("Project not found");
        }

        // 5. Get reference images
        const referenceImages = await ctx.runQuery(api.referenceImages.listByProject, {
            projectId: post.projectId,
        });

        const referenceImageUrls: Array<{ url: string }> = referenceImages
            .filter((img) => img.url)
            .map((img) => ({ url: img.url! }));

        // 6. Build image prompt with feedback
        let imagePrompt = post.imagePrompt || IMAGE_GENERATION_PROMPT({
            brandName: project.name,
            visualStyle: "Moderno e profissional",
            caption: post.caption,
            hasReferenceImages: referenceImageUrls.length > 0,
            postType: (post.brief?.postType as PostType) || "conteudo_profissional",
        });

        // Append user feedback to the prompt
        if (args.feedback) {
            imagePrompt += `\n\n## USER FEEDBACK - IMPORTANT\nThe user wants the following changes to the image:\n"${args.feedback}"\n\nMake sure to incorporate this feedback while maintaining the photorealistic style.`;
        }

        // 7. Generate new image
        let imageStorageId: Id<"_storage"> | undefined;
        let imageUrl: string | null = null;

        try {
            const imageResult = await generateImage(imagePrompt, {
                referenceImages: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
            });

            const binaryData = Uint8Array.from(atob(imageResult.imageBase64), (c) => c.charCodeAt(0));
            const blob = new Blob([binaryData], { type: imageResult.mimeType });
            imageStorageId = await ctx.storage.store(blob);
            imageUrl = await ctx.storage.getUrl(imageStorageId);
        } catch (imageError) {
            console.error("Image regeneration failed:", imageError);
            throw new Error("Falha ao regenerar imagem. Tente novamente.");
        }

        // 8. Update the post
        await ctx.runMutation(api.generatedPosts.updateImage, {
            id: args.generatedPostId,
            imageStorageId,
            imagePrompt,
            imageModel: MODELS.GEMINI_3_PRO_IMAGE,
            feedback: args.feedback,
        });

        // 9. Consume credit
        await ctx.runMutation(api.billing.usage.consumePrompt, { count: 1 });

        return { success: true, imageUrl };
    },
});

// Regenerate caption with optional feedback
export const regenerateCaption = action({
    args: {
        generatedPostId: v.id("generated_posts"),
        feedback: v.optional(v.string()), // User feedback like "more casual", "add emoji"
        keepImage: v.optional(v.boolean()), // If false, also regenerate image
    },
    handler: async (ctx, args): Promise<{ success: boolean; caption: string; imageUrl: string | null }> => {
        // 1. Check authentication
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // 2. Check quota
        const creditsNeeded = args.keepImage !== false ? 1 : 2;
        const quota = await ctx.runQuery(api.billing.usage.checkQuota, {});
        if (!quota || quota.remaining < creditsNeeded) {
            throw new Error(
                `Creditos insuficientes. Voce precisa de ${creditsNeeded} credito(s). Creditos restantes: ${quota?.remaining ?? 0}`
            );
        }

        // 3. Get the generated post
        const post = await ctx.runQuery(api.generatedPosts.get, { id: args.generatedPostId });
        if (!post) {
            throw new Error("Post not found");
        }

        // 4. Get project info
        const project = await ctx.runQuery(api.projects.get, { projectId: post.projectId });
        if (!project) {
            throw new Error("Project not found");
        }

        // 5. Build caption regeneration prompt
        const captionPrompt = `Reescreva esta legenda de Instagram para a marca "${project.name}".

## Legenda Atual
"${post.caption}"

${args.feedback ? `## FEEDBACK DO USUARIO - IMPORTANTE
O usuario quer as seguintes mudancas:
"${args.feedback}"

Incorpore este feedback na nova legenda.
` : "## Instrucao\nCrie uma variacao diferente mantendo a mesma essencia e objetivo."}

## Regras
- Mantenha o mesmo tom e estilo da marca
- A legenda deve ter tamanho similar
- Inclua hashtags relevantes se a original tinha
- Responda em JSON: { "caption": "nova legenda completa", "reasoning": "por que essas mudancas" }`;

        // 6. Generate new caption
        const response = await callLLM(
            [
                { role: "system", content: "Voce e um especialista em legendas para Instagram. Responda apenas com JSON valido." },
                { role: "user", content: captionPrompt },
            ],
            {
                model: MODELS.GPT_4_1,
                temperature: 0.8,
                maxTokens: 1024,
            }
        );

        const generated = parseJSONResponse<{ caption: string; reasoning: string }>(response.content);

        // 7. Handle image
        let imageUrl = post.imageUrl;
        let newImageStorageId = post.imageStorageId;

        if (args.keepImage === false) {
            // Also regenerate image
            const referenceImages = await ctx.runQuery(api.referenceImages.listByProject, {
                projectId: post.projectId,
            });

            const referenceImageUrls: Array<{ url: string }> = referenceImages
                .filter((img) => img.url)
                .map((img) => ({ url: img.url! }));

            const imagePrompt = IMAGE_GENERATION_PROMPT({
                brandName: project.name,
                visualStyle: "Moderno e profissional",
                caption: generated.caption,
                hasReferenceImages: referenceImageUrls.length > 0,
                postType: (post.brief?.postType as PostType) || "conteudo_profissional",
            });

            try {
                const imageResult = await generateImage(imagePrompt, {
                    referenceImages: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
                });

                const binaryData = Uint8Array.from(atob(imageResult.imageBase64), (c) => c.charCodeAt(0));
                const blob = new Blob([binaryData], { type: imageResult.mimeType });
                newImageStorageId = await ctx.storage.store(blob);
                imageUrl = await ctx.storage.getUrl(newImageStorageId);
            } catch (imageError) {
                console.error("Image regeneration failed:", imageError);
                // Continue without new image
            }
        }

        // 8. Save to history and update post
        const existingVersions = await ctx.runQuery(api.generationHistory.getHistory, {
            generatedPostId: args.generatedPostId,
        });

        await ctx.runMutation(api.generationHistory.saveVersion, {
            generatedPostId: args.generatedPostId,
            caption: generated.caption,
            imageStorageId: newImageStorageId,
            imagePrompt: post.imagePrompt,
            action: args.keepImage === false ? "regenerate_both" : "regenerate_caption",
            feedback: args.feedback,
            model: MODELS.GPT_4_1,
            imageModel: newImageStorageId !== post.imageStorageId ? MODELS.GEMINI_3_PRO_IMAGE : post.imageModel,
        });

        await ctx.runMutation(api.generatedPosts.updateRegenerated, {
            id: args.generatedPostId,
            caption: generated.caption,
            reasoning: generated.reasoning,
        });

        // If image was also regenerated, update it
        if (newImageStorageId && newImageStorageId !== post.imageStorageId) {
            await ctx.runMutation(api.generatedPosts.updateImage, {
                id: args.generatedPostId,
                imageStorageId: newImageStorageId,
                imagePrompt: post.imagePrompt || "",
                imageModel: MODELS.GEMINI_3_PRO_IMAGE,
            });
        }

        // 9. Consume credits
        await ctx.runMutation(api.billing.usage.consumePrompt, { count: creditsNeeded });

        return { success: true, caption: generated.caption, imageUrl };
    },
});
