"use node";

import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { generateImage } from "./agents/index";
import { createThumbnailBlob } from "../mediaProcessing";
import {
    calculateDimensions,
    type AspectRatio,
    type Resolution,
} from "./llm/index";

export type PersistSingleGeneratedImageParams = {
    ctx: ActionCtx;
    userId: Id<"users">;
    projectId?: Id<"projects">;
    /** When set, updates batch pending state on success/failure */
    batchId?: Id<"media_generation_batches">;
    message: string;
    userPrompt: string;
    model: string;
    aspectRatio: AspectRatio;
    resolution: Resolution;
    layoutReferenceUrls: string[];
    productReferenceUrls: string[];
    styleReferenceUrls: string[];
    layoutVisionPrompt?: string;
    stylePreset?: string;
};

export type PersistSingleGeneratedImageResult =
    | { success: true; mediaItemId: Id<"media_items"> }
    | { success: false; errorMessage: string };

/**
 * Single-model image generation + storage + media_items row.
 * Shared by processBatch (/images) and composePostFromBrief orchestrator.
 */
export async function persistSingleGeneratedImage(
    params: PersistSingleGeneratedImageParams
): Promise<PersistSingleGeneratedImageResult> {
    const {
        ctx,
        userId,
        projectId,
        batchId,
        message,
        userPrompt,
        model,
        aspectRatio,
        resolution,
        layoutReferenceUrls,
        productReferenceUrls,
        styleReferenceUrls,
        layoutVisionPrompt,
        stylePreset,
    } = params;

    const dimensions = calculateDimensions(aspectRatio, resolution);
    const startedAt = Date.now();

    try {
        const imageResult = await generateImage({
            caption: "",
            instructions: message,
            model,
            aspectRatio,
            resolution,
            ...(layoutReferenceUrls.length > 0 && { layoutReferenceUrls }),
            ...(productReferenceUrls.length > 0 && { productReferenceUrls }),
            ...(styleReferenceUrls.length > 0 && { styleReferenceUrls }),
            ...(layoutVisionPrompt && { layoutVisionPrompt }),
            ...(stylePreset && { stylePreset }),
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

        const mediaItemId = await ctx.runMutation(internal.mediaItems.create, {
            userId,
            ...(projectId && { projectId }),
            storageId,
            ...(thumbnailStorageId && { thumbnailStorageId }),
            mimeType: imageResult.mimeType,
            width: imageResult.dimensions?.width ?? dimensions.width,
            height: imageResult.dimensions?.height ?? dimensions.height,
            sourceType: "generated",
            model,
            prompt: imageResult.prompt,
            userPrompt,
            generationDurationMs: Date.now() - startedAt,
            aspectRatio,
            resolution,
            ...(batchId && { batchId }),
        });

        if (batchId) {
            await ctx.runMutation(internal.mediaGenerationBatches.removeFromPending, {
                id: batchId,
                model,
            });
        }

        return { success: true, mediaItemId };
    } catch (err) {
        console.error(`[persistSingleGeneratedImage] Failed for ${model}:`, err);
        if (batchId) {
            await ctx.runMutation(internal.mediaGenerationBatches.removeFromPending, {
                id: batchId,
                model,
            });
        }
        return {
            success: false,
            errorMessage: err instanceof Error ? err.message : "Erro ao gerar imagem",
        };
    }
}
