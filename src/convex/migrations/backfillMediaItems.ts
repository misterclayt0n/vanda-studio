import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

const BATCH_SIZE = 100;

// Backfill media_items from generated_images
export const backfillFromGeneratedImages = internalMutation({
    args: {
        cursor: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const result = await ctx.db
            .query("generated_images")
            .paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE });

        let created = 0;

        for (const image of result.page) {
            // Check if already backfilled
            const existing = await ctx.db
                .query("media_items")
                .withIndex("by_legacy_image", (q) => q.eq("legacyGeneratedImageId", image._id))
                .first();

            if (existing) continue;

            // Get the post to find userId and projectId
            const post = await ctx.db.get(image.generatedPostId);
            if (!post) continue;

            // Determine userId
            let userId = post.userId;
            if (!userId && post.projectId) {
                const project = await ctx.db.get(post.projectId);
                if (project) userId = project.userId;
            }
            if (!userId) continue;

            const now = Date.now();
            const mediaItemId = await ctx.db.insert("media_items", {
                userId,
                ...(post.projectId && { projectId: post.projectId }),
                storageId: image.storageId,
                mimeType: "image/png", // Default - generated images are typically PNG
                width: image.width,
                height: image.height,
                sourceType: post.sourceOutputId ? "edited" : "generated",
                model: image.model,
                prompt: image.prompt,
                aspectRatio: image.aspectRatio,
                resolution: image.resolution,
                legacyGeneratedImageId: image._id,
                legacyPostId: post._id,
                ...(post.sourceConversationId && { sourceConversationId: post.sourceConversationId }),
                ...(post.sourceOutputId && { sourceOutputId: post.sourceOutputId }),
                createdAt: image.createdAt,
                updatedAt: now,
            });

            // Also create post_media_items link
            await ctx.db.insert("post_media_items", {
                postId: image.generatedPostId,
                mediaItemId,
                position: 0,
                role: "cover",
            });

            created++;
        }

        // Schedule next batch if there are more
        if (!result.isDone) {
            await ctx.scheduler.runAfter(0, internal.migrations.backfillMediaItems.backfillFromGeneratedImages, {
                cursor: result.continueCursor,
            });
        }

        return {
            created,
            hasMore: !result.isDone,
        };
    },
});

// Backfill media_items from image_edit_outputs (that don't already have corresponding generated_images)
export const backfillFromEditOutputs = internalMutation({
    args: {
        cursor: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const result = await ctx.db
            .query("image_edit_outputs")
            .paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE });

        let created = 0;

        for (const output of result.page) {
            // Check if already backfilled via sourceOutputId
            const existing = await ctx.db
                .query("media_items")
                .withIndex("by_source_output", (q) => q.eq("sourceOutputId", output._id))
                .first();

            if (existing) continue;

            // Get conversation to find userId
            const conversation = await ctx.db.get(output.conversationId);
            if (!conversation) continue;

            const now = Date.now();
            await ctx.db.insert("media_items", {
                userId: conversation.userId,
                storageId: output.storageId,
                mimeType: "image/png",
                width: output.width,
                height: output.height,
                sourceType: "edited",
                model: output.model,
                prompt: output.prompt,
                aspectRatio: conversation.aspectRatio,
                resolution: conversation.resolution,
                sourceConversationId: output.conversationId,
                sourceTurnId: output.turnId,
                sourceOutputId: output._id,
                createdAt: output.createdAt,
                updatedAt: now,
            });

            created++;
        }

        if (!result.isDone) {
            await ctx.scheduler.runAfter(0, internal.migrations.backfillMediaItems.backfillFromEditOutputs, {
                cursor: result.continueCursor,
            });
        }

        return {
            created,
            hasMore: !result.isDone,
        };
    },
});
