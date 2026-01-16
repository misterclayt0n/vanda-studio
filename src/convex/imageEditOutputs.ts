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

// Create a new output
export const create = internalMutation({
    args: {
        turnId: v.id("image_edit_turns"),
        conversationId: v.id("image_edit_conversations"),
        storageId: v.id("_storage"),
        model: v.string(),
        prompt: v.string(),
        width: v.number(),
        height: v.number(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("image_edit_outputs", {
            turnId: args.turnId,
            conversationId: args.conversationId,
            storageId: args.storageId,
            model: args.model,
            prompt: args.prompt,
            width: args.width,
            height: args.height,
            createdAt: Date.now(),
        });
    },
});
