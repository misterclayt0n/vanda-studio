"use node";

import { Jimp, JimpMime } from "jimp";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const THUMBNAIL_MAX_EDGE = 640;
const THUMBNAIL_QUALITY = 78;
const JPEG_SOURCE_TYPES = new Set([
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/heic",
    "image/heif",
    "image/avif",
    "image/tiff",
    "image/bmp",
]);

export async function createThumbnailBlob(sourceBlob: Blob): Promise<Blob | null> {
    try {
        const sourceBuffer = Buffer.from(await sourceBlob.arrayBuffer());
        const image = await Jimp.read(sourceBuffer);
        const maxEdge = Math.max(image.bitmap.width, image.bitmap.height);

        if (maxEdge > THUMBNAIL_MAX_EDGE) {
            const scale = THUMBNAIL_MAX_EDGE / maxEdge;
            image.resize({
                w: Math.max(1, Math.round(image.bitmap.width * scale)),
                h: Math.max(1, Math.round(image.bitmap.height * scale)),
            });
        }

        const targetMime = JPEG_SOURCE_TYPES.has(sourceBlob.type) ? JimpMime.jpeg : JimpMime.png;
        const thumbnailBuffer =
            targetMime === JimpMime.jpeg
                ? await image.getBuffer(targetMime, {
                      quality: THUMBNAIL_QUALITY,
                  })
                : await image.getBuffer(targetMime);

        return new Blob([new Uint8Array(thumbnailBuffer)], { type: targetMime });
    } catch (error) {
        console.error("[MEDIA_PROCESSING] Failed to create thumbnail:", error);
        return null;
    }
}

export const generateThumbnailForMedia = internalAction({
    args: {
        mediaItemId: v.id("media_items"),
    },
    handler: async (ctx, args) => {
        const mediaItem = await ctx.runQuery(internal.mediaItems.getInternal, {
            id: args.mediaItemId,
        });

        if (!mediaItem || mediaItem.deletedAt || mediaItem.thumbnailStorageId) {
            return false;
        }

        const sourceBlob = await ctx.storage.get(mediaItem.storageId);
        if (!sourceBlob) {
            await ctx.runMutation(internal.mediaItems.setThumbnailError, {
                id: args.mediaItemId,
            });
            return false;
        }

        const thumbnailBlob = await createThumbnailBlob(sourceBlob);
        if (!thumbnailBlob) {
            await ctx.runMutation(internal.mediaItems.setThumbnailError, {
                id: args.mediaItemId,
            });
            return false;
        }

        const thumbnailStorageId = await ctx.storage.store(thumbnailBlob);

        await ctx.runMutation(internal.mediaItems.setThumbnailReady, {
            id: args.mediaItemId,
            thumbnailStorageId,
        });

        if (mediaItem.sourceOutputId) {
            await ctx.runMutation(internal.imageEditOutputs.setThumbnail, {
                id: mediaItem.sourceOutputId,
                thumbnailStorageId,
            });
        }

        return true;
    },
});
