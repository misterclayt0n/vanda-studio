"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { generateImage } from "./agents/index";
import { reserveImageUsage, refundImageUsage } from "../billing/autumnUsage";
import {
    DEFAULT_IMAGE_MODEL,
    type AspectRatio,
    type Resolution,
    calculateDimensions,
} from "./llm/index";

/**
 * Standalone image generation action.
 * Creates media_items directly WITHOUT creating posts.
 * Returns a batchId for progressive loading.
 */

const projectContextValidator = v.optional(
    v.object({
        accountDescription: v.optional(v.string()),
        brandTraits: v.optional(v.array(v.string())),
        additionalContext: v.optional(v.string()),
        contextImageUrls: v.optional(v.array(v.string())),
    })
);

export const generate = action({
    args: {
        projectId: v.optional(v.id("projects")),
        message: v.string(),
        imageModels: v.optional(v.array(v.string())),
        aspectRatio: v.optional(v.string()),
        resolution: v.optional(v.string()),
        referenceImageUrls: v.optional(v.array(v.string())),
        manualReferenceIds: v.optional(v.array(v.id("_storage"))),
        projectContext: projectContextValidator,
    },
    handler: async (ctx, args): Promise<{
        success: boolean;
        batchId: Id<"media_generation_batches">;
    }> => {
        // 1. Auth check
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Você precisa estar autenticado");
        }

        const user = await ctx.runQuery(api.users.current, {});
        if (!user) {
            throw new Error("Usuário não encontrado");
        }

        // 2. Verify project access if provided
        if (args.projectId) {
            const project = await ctx.runQuery(api.projects.get, {
                projectId: args.projectId,
            });
            if (!project) {
                throw new Error("Projeto não encontrado");
            }
        }

        // 3. Parse settings
        const imageModels = args.imageModels ?? [DEFAULT_IMAGE_MODEL];
        const aspectRatio = (args.aspectRatio ?? "1:1") as AspectRatio;
        const resolution = (args.resolution ?? "standard") as Resolution;
        const dimensions = calculateDimensions(aspectRatio, resolution);

        // 4. Reserve usage
        const reservedCount = await reserveImageUsage(ctx, imageModels.length);

        // 5. Create batch for progressive loading
        const batchId = await ctx.runMutation(internal.mediaGenerationBatches.create, {
            userId: user._id,
            ...(args.projectId && { projectId: args.projectId }),
            totalModels: imageModels.length,
            pendingModels: imageModels,
            prompt: args.message,
            aspectRatio,
            resolution,
        });

        // 6. Collect reference image URLs
        const referenceImageUrls: string[] = [];
        if (args.referenceImageUrls) {
            referenceImageUrls.push(...args.referenceImageUrls);
        }
        if (args.manualReferenceIds && args.manualReferenceIds.length > 0) {
            for (const storageId of args.manualReferenceIds) {
                const url = await ctx.storage.getUrl(storageId);
                if (url) {
                    referenceImageUrls.push(url);
                }
            }
        }
        if (args.projectContext?.contextImageUrls) {
            referenceImageUrls.push(...args.projectContext.contextImageUrls);
        }

        // 7. Generate images in parallel
        console.log(`[GENERATE_IMAGES] Starting parallel generation for ${imageModels.length} models`);

        const results = await Promise.all(
            imageModels.map(async (model) => {
                try {
                    console.log(`[GENERATE_IMAGES] Generating with model: ${model}`);

                    const imageResult = await generateImage({
                        caption: "",
                        instructions: args.message,
                        model,
                        aspectRatio,
                        resolution,
                        ...(referenceImageUrls.length > 0 && { referenceImageUrls }),
                    });

                    // Store the image
                    const binaryData = Uint8Array.from(atob(imageResult.imageBase64), (c) =>
                        c.charCodeAt(0)
                    );
                    const blob = new Blob([binaryData], { type: imageResult.mimeType });
                    const storageId = await ctx.storage.store(blob);

                    // Create media_items row
                    await ctx.runMutation(internal.mediaItems.create, {
                        userId: user._id,
                        ...(args.projectId && { projectId: args.projectId }),
                        storageId,
                        mimeType: imageResult.mimeType,
                        width: imageResult.dimensions?.width ?? dimensions.width,
                        height: imageResult.dimensions?.height ?? dimensions.height,
                        sourceType: "generated",
                        model,
                        prompt: imageResult.prompt,
                        aspectRatio,
                        resolution,
                        batchId,
                    });

                    // Remove from pending
                    await ctx.runMutation(internal.mediaGenerationBatches.removeFromPending, {
                        id: batchId,
                        model,
                    });

                    console.log(`[GENERATE_IMAGES] Successfully generated with ${model}`);
                    return { success: true as const, model };
                } catch (err) {
                    console.error(`[GENERATE_IMAGES] Generation failed for ${model}:`, err);
                    await ctx.runMutation(internal.mediaGenerationBatches.removeFromPending, {
                        id: batchId,
                        model,
                    });
                    return {
                        success: false as const,
                        model,
                        errorMessage: err instanceof Error ? err.message : "Erro ao gerar imagem",
                    };
                }
            })
        );

        const failedResults = results.filter((result) => !result.success);
        const failedCount = failedResults.length;
        if (failedCount > 0) {
            await refundImageUsage(ctx, failedCount);
        }

        if (failedCount === imageModels.length) {
            await ctx.runMutation(internal.mediaGenerationBatches.markError, { id: batchId });
            const firstFailure = failedResults[0];
            throw new Error(
                firstFailure?.errorMessage ?? "Não foi possível gerar imagens com os modelos selecionados."
            );
        }

        console.log(`[GENERATE_IMAGES] Batch ${batchId} complete`);

        return {
            success: true,
            batchId,
        };
    },
});
