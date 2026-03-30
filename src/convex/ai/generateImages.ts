"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { refundAiUsage, reserveAiUsage } from "../billing/autumnUsage";
import { persistSingleGeneratedImage } from "./imageGenerationPersist";
import { coerceImageGenerationSettings } from "../../lib/studio/imageGenerationCapabilities";
import {
    getStoredImageGenerationError,
    throwImageGenerationError,
} from "../imageGenerationErrors";

function publicAppOriginForTemplates(): string {
    const raw =
        process.env.PUBLIC_APP_URL?.trim() ||
        process.env.SITE_URL?.trim() ||
        "https://vanda.studio";
    return raw.replace(/\/$/, "");
}
import {
    DEFAULT_IMAGE_MODEL,
    type AspectRatio,
    type Resolution,
} from "./llm/index";
import {
    estimateImageBatchUsage,
    estimateImageLineItem,
} from "../../lib/billing/aiCredits";
import { projectContextValidator } from "./projectContextValidator";
import {
    getPostTemplateById,
    getPostTemplateReferenceFiles,
    getTemplateReferencePublicUrl,
} from "../../lib/data/postTemplates";

/**
 * Standalone image generation action.
 * Creates media_items directly WITHOUT creating posts.
 * Returns a batchId for progressive loading.
 */

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
        stylePreset: v.optional(v.string()),
        templateId: v.optional(v.string()),
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

        const user = await ctx.runMutation(api.users.ensureCurrent, {});

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

        const usageItems = estimateImageBatchUsage(imageModels);
        const reservation = await reserveAiUsage(ctx, usageItems);

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

        const productReferenceUrls: string[] = [];
        if (args.referenceImageUrls) {
            productReferenceUrls.push(...args.referenceImageUrls);
        }
        if (args.manualReferenceIds && args.manualReferenceIds.length > 0) {
            for (const storageId of args.manualReferenceIds) {
                const url = await ctx.storage.getUrl(storageId);
                if (url) {
                    productReferenceUrls.push(url);
                }
            }
        }

        const styleReferenceUrls: string[] = [];
        if (args.projectContext?.contextImageUrls) {
            styleReferenceUrls.push(...args.projectContext.contextImageUrls);
        }

        const layoutReferenceUrls: string[] = [];
        let layoutVisionPrompt: string | undefined;
        if (args.templateId?.trim()) {
            const template = getPostTemplateById(args.templateId.trim());
            if (!template) {
                throwImageGenerationError("UNSUPPORTED_SETTINGS", {
                    title: "Template inválido",
                    message: "O modelo de post selecionado não existe. Escolha outro template.",
                });
            }
            const origin = publicAppOriginForTemplates();
            const refFiles = getPostTemplateReferenceFiles(template);
            layoutReferenceUrls.push(
                getTemplateReferencePublicUrl(origin, refFiles[0]!)
            );
            layoutVisionPrompt = template.visionPrompt;
        }

        const brandMd = args.projectContext?.brandContextMarkdown?.trim();
        const augmentedMessage = brandMd
            ? `${brandMd}\n\n## Pedido de imagem\n${args.message}`
            : args.message;

        try {
            await ctx.scheduler.runAfter(0, internal.ai.generateImages.processBatch, {
                batchId,
                userId: user._id,
                ...(args.projectId && { projectId: args.projectId }),
                message: augmentedMessage,
                userPrompt: args.message,
                imageModels,
                aspectRatio,
                resolution,
                layoutReferenceUrls,
                productReferenceUrls,
                styleReferenceUrls,
                ...(layoutVisionPrompt && { layoutVisionPrompt }),
                ...(args.stylePreset && { stylePreset: args.stylePreset }),
            });
        } catch (err) {
            const storedError = getStoredImageGenerationError(err);
            await refundAiUsage(ctx, reservation);
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
        userPrompt: v.string(),
        imageModels: v.array(v.string()),
        aspectRatio: v.string(),
        resolution: v.string(),
        layoutReferenceUrls: v.array(v.string()),
        productReferenceUrls: v.array(v.string()),
        styleReferenceUrls: v.array(v.string()),
        layoutVisionPrompt: v.optional(v.string()),
        stylePreset: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<void> => {
        const aspectRatio = args.aspectRatio as AspectRatio;
        const resolution = args.resolution as Resolution;

        let results:
            | Array<
                  | { success: true; model: string }
                  | { success: false; model: string; errorMessage: string }
              >
            | null = null;

        try {
            results = await Promise.all(
                args.imageModels.map(async (model) => {
                    const out = await persistSingleGeneratedImage({
                        ctx,
                        userId: args.userId,
                        ...(args.projectId && { projectId: args.projectId }),
                        batchId: args.batchId,
                        message: args.message,
                        userPrompt: args.userPrompt,
                        model,
                        aspectRatio,
                        resolution,
                        layoutReferenceUrls: args.layoutReferenceUrls,
                        productReferenceUrls: args.productReferenceUrls,
                        styleReferenceUrls: args.styleReferenceUrls,
                        ...(args.layoutVisionPrompt && { layoutVisionPrompt: args.layoutVisionPrompt }),
                        ...(args.stylePreset && { stylePreset: args.stylePreset }),
                    });
                    if (out.success) {
                        return { success: true as const, model };
                    }
                    return {
                        success: false as const,
                        model,
                        errorMessage: out.errorMessage,
                    };
                })
            );
        } catch (err) {
            console.error(`[GENERATE_IMAGES] Async batch ${args.batchId} failed:`, err);
            const storedError = getStoredImageGenerationError(err);
            await refundAiUsage(ctx, estimateImageBatchUsage(args.imageModels));
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
            await refundAiUsage(
                ctx,
                failedResults.map((result) => estimateImageLineItem(result.model))
            );
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
