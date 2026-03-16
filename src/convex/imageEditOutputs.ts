import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

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

// Create a new output AND its corresponding media_items entry
export const create = internalMutation({
    args: {
        turnId: v.id("image_edit_turns"),
        conversationId: v.id("image_edit_conversations"),
        storageId: v.id("_storage"),
        model: v.string(),
        prompt: v.string(),
        width: v.number(),
        height: v.number(),
        // Metadata
        aspectRatio: v.string(),
        resolution: v.string(),
        userId: v.id("users"),
        projectId: v.optional(v.id("projects")),
        // Legacy fields (kept for backwards compat during transition)
        originalPostId: v.optional(v.id("generated_posts")),
        originalCaption: v.optional(v.string()),
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

        // 2. Create media_items entry (replaces synthetic post+image creation)
        await ctx.db.insert("media_items", {
            userId: args.userId,
            ...(args.projectId && { projectId: args.projectId }),
            storageId: args.storageId,
            mimeType: "image/png",
            width: args.width,
            height: args.height,
            sourceType: "edited",
            model: args.model,
            prompt: args.prompt,
            aspectRatio: args.aspectRatio,
            resolution: args.resolution,
            sourceConversationId: args.conversationId,
            sourceTurnId: args.turnId,
            sourceOutputId: outputId,
            createdAt: now,
            updatedAt: now,
        });

        return outputId;
    },
});
