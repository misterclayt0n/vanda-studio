"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { generateImage } from "./agents/index";
import { reserveImageUsage, refundImageUsage } from "../billing/autumnUsage";
import { createThumbnailBlob } from "../mediaProcessing";
import { coerceImageGenerationSettings } from "../../lib/studio/imageGenerationCapabilities";
import {
    getStoredImageGenerationError,
    throwImageGenerationError,
} from "../imageGenerationErrors";
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
            throwImageGenerationError("AUTH_REQUIRED");
        }

        const user = await ctx.runQuery(api.users.current, {});
        if (!user) {
            throwImageGenerationError("AUTH_REQUIRED");
        }

        // 2. Verify project access if provided
        if (args.projectId) {
            const project = await ctx.runQuery(api.projects.get, {
                projectId: args.projectId,
            });
            if (!project) {
                throwImageGenerationError("PROJECT_NOT_FOUND");
            }
        }

        const imageModels = args.imageModels ?? [DEFAULT_IMAGE_MODEL];
        const normalizedSettings = coerceImageGenerationSettings(
            imageModels,
            args.aspectRatio,
            args.resolution
        );
        const aspectRatio = normalizedSettings.aspectRatio as AspectRatio;
        const resolution = normalizedSettings.resolution as Resolution;

        const reservedCount = await reserveImageUsage(ctx, imageModels.length);

        const batchId = await ctx.runMutation(internal.mediaGenerationBatches.create, {
            userId: user._id,
            ...(args.projectId && { projectId: args.projectId }),
            totalModels: imageModels.length,
            pendingModels: imageModels,
            requestedModels: imageModels,
            prompt: args.message,
            aspectRatio,
            resolution,
        });

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

        try {
            await ctx.scheduler.runAfter(0, internal.ai.generateImages.processBatch, {
                batchId,
                userId: user._id,
                ...(args.projectId && { projectId: args.projectId }),
                message: args.message,
                imageModels,
                aspectRatio,
                resolution,
                referenceImageUrls,
                reservedCount,
            });
        } catch (err) {
            const storedError = getStoredImageGenerationError(err);
            await refundImageUsage(ctx, reservedCount);
            await ctx.runMutation(internal.mediaGenerationBatches.markError, {
                id: batchId,
                clearPending: true,
                errorCode: storedError.code,
                errorMessage: storedError.message,
            });
            throw err;
        }

        return {
            success: true,
            batchId,
        };
    },
});

export const processBatch = internalAction({
    args: {
        batchId: v.id("media_generation_batches"),
        userId: v.id("users"),
        projectId: v.optional(v.id("projects")),
        message: v.string(),
        imageModels: v.array(v.string()),
        aspectRatio: v.string(),
        resolution: v.string(),
        referenceImageUrls: v.array(v.string()),
        reservedCount: v.number(),
    },
    handler: async (ctx, args): Promise<void> => {
        const aspectRatio = args.aspectRatio as AspectRatio;
        const resolution = args.resolution as Resolution;
        const dimensions = calculateDimensions(aspectRatio, resolution);

        let results:
            | Array<
                  | { success: true; model: string }
                  | { success: false; model: string; errorMessage: string }
              >
            | null = null;

        try {
            results = await Promise.all(
                args.imageModels.map(async (model) => {
                    const startedAt = Date.now();
                    try {
                        const imageResult = await generateImage({
                            caption: "",
                            instructions: args.message,
                            model,
                            aspectRatio,
                            resolution,
                            ...(args.referenceImageUrls.length > 0
                                ? { referenceImageUrls: args.referenceImageUrls }
                                : {}),
                        });

                        const binaryData = Uint8Array.from(atob(imageResult.imageBase64), (char) =>
                            char.charCodeAt(0)
                        );
                        const blob = new Blob([binaryData], { type: imageResult.mimeType });
                        const thumbnailBlob = await createThumbnailBlob(blob);
                        const storageId = await ctx.storage.store(blob);
                        const thumbnailStorageId = thumbnailBlob
                            ? await ctx.storage.store(thumbnailBlob)
                            : undefined;

                        await ctx.runMutation(internal.mediaItems.create, {
                            userId: args.userId,
                            ...(args.projectId && { projectId: args.projectId }),
                            storageId,
                            ...(thumbnailStorageId && { thumbnailStorageId }),
                            mimeType: imageResult.mimeType,
                            width: imageResult.dimensions?.width ?? dimensions.width,
                            height: imageResult.dimensions?.height ?? dimensions.height,
                            sourceType: "generated",
                            model,
                            prompt: imageResult.prompt,
                            userPrompt: args.message,
                            generationDurationMs: Date.now() - startedAt,
                            aspectRatio,
                            resolution,
                            batchId: args.batchId,
                        });

                        await ctx.runMutation(internal.mediaGenerationBatches.removeFromPending, {
                            id: args.batchId,
                            model,
                        });

                        return { success: true as const, model };
                    } catch (err) {
                        console.error(`[GENERATE_IMAGES] Generation failed for ${model}:`, err);
                        await ctx.runMutation(internal.mediaGenerationBatches.removeFromPending, {
                            id: args.batchId,
                            model,
                        });
                        return {
                            success: false as const,
                            model,
                            errorMessage:
                                err instanceof Error ? err.message : "Erro ao gerar imagem",
                        };
                    }
                })
            );
        } catch (err) {
            console.error(`[GENERATE_IMAGES] Async batch ${args.batchId} failed:`, err);
            const storedError = getStoredImageGenerationError(err);
            await refundImageUsage(ctx, args.reservedCount);
            await ctx.runMutation(internal.mediaGenerationBatches.markError, {
                id: args.batchId,
                clearPending: true,
                errorCode: storedError.code,
                errorMessage: storedError.message,
            });
            return;
        }

        const failedResults = results.filter((result) => !result.success);
        const failedCount = failedResults.length;
        if (failedCount > 0) {
            await refundImageUsage(ctx, failedCount);
        }

        if (failedCount === args.imageModels.length) {
            const storedError = getStoredImageGenerationError(
                failedResults[0],
                "GENERATION_FAILED"
            );
            await ctx.runMutation(internal.mediaGenerationBatches.markError, {
                id: args.batchId,
                errorCode: storedError.code,
                errorMessage: storedError.message,
            });
        }
    },
});
