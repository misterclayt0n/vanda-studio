import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";

// List all outputs for a turn with URLs
export const listByTurn = query({
    args: {
        turnId: v.id("image_edit_turns"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const outputs = await ctx.db
            .query("image_edit_outputs")
            .withIndex("by_turn", (q) => q.eq("turnId", args.turnId))
            .collect();

        return Promise.all(
            outputs.map(async (output) => ({
                ...output,
                url: await ctx.storage.getUrl(output.storageId),
            }))
        );
    },
});

// List all outputs for a conversation (for thumbnail strip)
export const listByConversation = query({
    args: {
        conversationId: v.id("image_edit_conversations"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const outputs = await ctx.db
            .query("image_edit_outputs")
            .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
            .order("asc")
            .collect();

        return Promise.all(
            outputs.map(async (output) => ({
                ...output,
                url: await ctx.storage.getUrl(output.storageId),
            }))
        );
    },
});

// Get a single output with URL
export const get = query({
    args: {
        id: v.id("image_edit_outputs"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const output = await ctx.db.get(args.id);
        if (!output) {
            return null;
        }

        const url = await ctx.storage.getUrl(output.storageId);

        return {
            ...output,
            url,
        };
    },
});

// ============================================================================
// Internal Mutations (called by actions)
// ============================================================================

// Create a new output AND its corresponding gallery post
export const create = internalMutation({
    args: {
        turnId: v.id("image_edit_turns"),
        conversationId: v.id("image_edit_conversations"),
        storageId: v.id("_storage"),
        model: v.string(),
        prompt: v.string(),
        width: v.number(),
        height: v.number(),
        // Data for creating gallery post (lineage tracking)
        aspectRatio: v.string(),
        resolution: v.string(),
        originalPostId: v.id("generated_posts"),
        originalCaption: v.string(),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        // 1. Create the output record
        const outputId = await ctx.db.insert("image_edit_outputs", {
            turnId: args.turnId,
            conversationId: args.conversationId,
            storageId: args.storageId,
            model: args.model,
            prompt: args.prompt,
            width: args.width,
            height: args.height,
            createdAt: now,
        });

        // 2. Create the corresponding gallery post (for composability)
        const postId = await ctx.db.insert("generated_posts", {
            userId: args.userId,
            caption: args.originalCaption,
            status: "edited",
            imageModel: args.model, // For gallery badge display
            // Lineage tracking
            parentPostId: args.originalPostId,
            sourceConversationId: args.conversationId,
            sourceOutputId: outputId,
            // Timestamps
            createdAt: now,
            updatedAt: now,
        });

        // 3. Create the generated_image linked to the new post
        await ctx.db.insert("generated_images", {
            generatedPostId: postId,
            storageId: args.storageId,
            model: args.model,
            aspectRatio: args.aspectRatio,
            resolution: args.resolution,
            prompt: args.prompt,
            width: args.width,
            height: args.height,
            createdAt: now,
        });

        return outputId;
    },
});
