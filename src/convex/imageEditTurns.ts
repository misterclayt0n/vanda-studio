import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// List all turns for a conversation with their outputs
export const listByConversation = query({
    args: {
        conversationId: v.id("image_edit_conversations"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const turns = await ctx.db
            .query("image_edit_turns")
            .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
            .order("asc")
            .collect();

        // Get outputs for each turn
        return Promise.all(
            turns.map(async (turn) => {
                const outputs = await ctx.db
                    .query("image_edit_outputs")
                    .withIndex("by_turn", (q) => q.eq("turnId", turn._id))
                    .collect();

                // Resolve URLs for outputs
                const outputsWithUrls = await Promise.all(
                    outputs.map(async (output) => ({
                        ...output,
                        url: await ctx.storage.getUrl(output.storageId),
                    }))
                );

                return {
                    ...turn,
                    outputs: outputsWithUrls,
                };
            })
        );
    },
});

// Get a single turn with its outputs
export const get = query({
    args: {
        id: v.id("image_edit_turns"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const turn = await ctx.db.get(args.id);
        if (!turn) {
            return null;
        }

        const outputs = await ctx.db
            .query("image_edit_outputs")
            .withIndex("by_turn", (q) => q.eq("turnId", turn._id))
            .collect();

        const outputsWithUrls = await Promise.all(
            outputs.map(async (output) => ({
                ...output,
                url: await ctx.storage.getUrl(output.storageId),
            }))
        );

        return {
            ...turn,
            outputs: outputsWithUrls,
        };
    },
});

// Get the latest turn for a conversation
export const getLatest = query({
    args: {
        conversationId: v.id("image_edit_conversations"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const turns = await ctx.db
            .query("image_edit_turns")
            .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
            .order("desc")
            .take(1);

        const turn = turns[0];
        if (!turn) {
            return null;
        }

        const outputs = await ctx.db
            .query("image_edit_outputs")
            .withIndex("by_turn", (q) => q.eq("turnId", turn._id))
            .collect();

        const outputsWithUrls = await Promise.all(
            outputs.map(async (output) => ({
                ...output,
                url: await ctx.storage.getUrl(output.storageId),
            }))
        );

        return {
            ...turn,
            outputs: outputsWithUrls,
        };
    },
});

// Count turns in a conversation
export const countByConversation = query({
    args: {
        conversationId: v.id("image_edit_conversations"),
    },
    handler: async (ctx, args) => {
        const turns = await ctx.db
            .query("image_edit_turns")
            .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
            .collect();

        return turns.length;
    },
});

// ============================================================================
// Internal Mutations (called by actions)
// ============================================================================

// Create a new turn
export const create = internalMutation({
    args: {
        conversationId: v.id("image_edit_conversations"),
        turnIndex: v.number(),
        userMessage: v.string(),
        selectedModels: v.array(v.string()),
        manualReferenceIds: v.optional(v.array(v.id("_storage"))),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("image_edit_turns", {
            conversationId: args.conversationId,
            turnIndex: args.turnIndex,
            userMessage: args.userMessage,
            selectedModels: args.selectedModels,
            ...(args.manualReferenceIds && { manualReferenceIds: args.manualReferenceIds }),
            status: "generating",
            pendingModels: args.selectedModels,
            createdAt: Date.now(),
        });
    },
});

// Update turn status
export const updateStatus = internalMutation({
    args: {
        id: v.id("image_edit_turns"),
        status: v.string(),
        pendingModels: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            status: args.status,
            ...(args.pendingModels !== undefined && { pendingModels: args.pendingModels }),
        });
    },
});

// Remove a model from pending (for progressive loading)
export const removeFromPending = internalMutation({
    args: {
        id: v.id("image_edit_turns"),
        model: v.string(),
    },
    handler: async (ctx, args) => {
        const turn = await ctx.db.get(args.id);
        if (!turn) return;

        const pending = turn.pendingModels?.filter((m) => m !== args.model) ?? [];
        
        // If no more pending, mark as completed
        const status = pending.length === 0 ? "completed" : turn.status;

        await ctx.db.patch(args.id, {
            pendingModels: pending,
            status,
        });
    },
});

// Mark turn as error
export const markError = internalMutation({
    args: {
        id: v.id("image_edit_turns"),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            status: "error",
            pendingModels: [],
        });
    },
});
