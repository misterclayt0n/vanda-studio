import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

function sortOutputsBySelectedModels<T extends { model: string }>(
    outputs: T[],
    selectedModels: string[]
): T[] {
    const order = new Map(selectedModels.map((model, index) => [model, index]));
    return [...outputs].sort((a, b) => {
        const left = order.get(a.model) ?? Number.MAX_SAFE_INTEGER;
        const right = order.get(b.model) ?? Number.MAX_SAFE_INTEGER;
        return left - right;
    });
}

function withTurnDefaults<
    T extends {
        aspectRatio?: string;
        resolution?: string;
    }
>(
    turn: T,
    conversation?: {
        aspectRatio?: string;
        resolution?: string;
    } | null
): T & { aspectRatio: string; resolution: string } {
    return {
        ...turn,
        aspectRatio: turn.aspectRatio ?? conversation?.aspectRatio ?? "1:1",
        resolution: turn.resolution ?? conversation?.resolution ?? "standard",
    };
}

type ConversationSummaryOutput = NonNullable<Doc<"image_edit_conversations">["latestOutputs"]>[number];

function summarizeOutputs(
    outputs: Doc<"image_edit_outputs">[],
    selectedModels: string[]
): ConversationSummaryOutput[] {
    return sortOutputsBySelectedModels(outputs, selectedModels).map((output) => ({
        outputId: output._id,
        storageId: output.storageId,
        model: output.model,
        width: output.width,
        height: output.height,
        createdAt: output.createdAt,
    }));
}

async function syncConversationSummary(
    ctx: { db: any },
    conversationId: Doc<"image_edit_conversations">["_id"]
) {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) {
        return;
    }

    const latestTurn = (
        await ctx.db
            .query("image_edit_turns")
            .withIndex("by_conversation", (q: any) => q.eq("conversationId", conversationId))
            .order("desc")
            .take(1)
    )[0];

    if (!latestTurn) {
        await ctx.db.patch(conversationId, {
            turnCount: 0,
            latestTurnId: undefined,
            latestTurnIndex: undefined,
            latestUserMessage: undefined,
            latestAspectRatio: undefined,
            latestResolution: undefined,
            latestStatus: undefined,
            latestPendingModels: undefined,
            latestProgressAt: undefined,
            latestOutputCount: 0,
            thumbnailStorageId: undefined,
            latestOutputs: [],
            updatedAt: Date.now(),
        });
        return;
    }

    const latestOutputs = await ctx.db
        .query("image_edit_outputs")
        .withIndex("by_turn", (q: any) => q.eq("turnId", latestTurn._id))
        .collect();

    const summaryOutputs = summarizeOutputs(latestOutputs, latestTurn.selectedModels);
    await ctx.db.patch(conversationId, {
        turnCount: latestTurn.turnIndex + 1,
        latestTurnId: latestTurn._id,
        latestTurnIndex: latestTurn.turnIndex,
        latestUserMessage: latestTurn.userMessage,
        latestAspectRatio: latestTurn.aspectRatio ?? conversation.aspectRatio ?? "1:1",
        latestResolution: latestTurn.resolution ?? conversation.resolution ?? "standard",
        latestStatus: latestTurn.status,
        latestPendingModels: latestTurn.pendingModels ?? [],
        latestProgressAt: latestTurn.lastProgressAt ?? latestTurn.createdAt,
        latestOutputCount: summaryOutputs.length,
        thumbnailStorageId: summaryOutputs[0]?.storageId,
        latestOutputs: summaryOutputs,
        updatedAt: Date.now(),
    });
}

async function loadTurnWithOutputs(ctx: any, turn: any) {
    const conversation = await ctx.db.get(turn.conversationId);
    const outputs = await ctx.db
        .query("image_edit_outputs")
        .withIndex("by_turn", (q: any) => q.eq("turnId", turn._id))
        .collect();

    const outputsWithUrls = await Promise.all(
        outputs.map(async (output: any) => ({
            ...output,
            url: await ctx.storage.getUrl(output.storageId),
        }))
    );

    return {
        ...withTurnDefaults(turn, conversation),
        outputs: sortOutputsBySelectedModels(outputsWithUrls, turn.selectedModels),
    };
}

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
                return loadTurnWithOutputs(
                    ctx,
                    turn
                );
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
        return loadTurnWithOutputs(
            ctx,
            turn
        );
    },
});

export const getInternal = internalQuery({
    args: {
        id: v.id("image_edit_turns"),
    },
    handler: async (ctx, args) => {
        const turn = await ctx.db.get(args.id);
        if (!turn) {
            return null;
        }

        return loadTurnWithOutputs(
            ctx,
            turn
        );
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
        return loadTurnWithOutputs(
            ctx,
            turn
        );
    },
});

// Get a turn by index (for getting previous turn's outputs)
export const getByIndex = query({
    args: {
        conversationId: v.id("image_edit_conversations"),
        turnIndex: v.number(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const turns = await ctx.db
            .query("image_edit_turns")
            .withIndex("by_conversation_turn", (q) =>
                q.eq("conversationId", args.conversationId).eq("turnIndex", args.turnIndex)
            )
            .take(1);

        const turn = turns[0];
        if (!turn) {
            return null;
        }
        return loadTurnWithOutputs(
            ctx,
            turn
        );
    },
});

export const getByIndexInternal = internalQuery({
    args: {
        conversationId: v.id("image_edit_conversations"),
        turnIndex: v.number(),
    },
    handler: async (ctx, args) => {
        const turns = await ctx.db
            .query("image_edit_turns")
            .withIndex("by_conversation_turn", (q) =>
                q.eq("conversationId", args.conversationId).eq("turnIndex", args.turnIndex)
            )
            .take(1);

        const turn = turns[0];
        if (!turn) {
            return null;
        }

        return loadTurnWithOutputs(
            {
                db: ctx.db,
                storage: ctx.storage,
            },
            turn
        );
    },
});

// Count turns in a conversation
export const countByConversation = query({
    args: {
        conversationId: v.id("image_edit_conversations"),
    },
    handler: async (ctx, args) => {
        const conversation = await ctx.db.get(args.conversationId);
        if (conversation?.turnCount !== undefined) {
            return conversation.turnCount;
        }

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
        selectedOutputIds: v.optional(v.array(v.id("image_edit_outputs"))),
        manualReferenceIds: v.optional(v.array(v.id("_storage"))),
        aspectRatio: v.string(),
        resolution: v.string(),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const turnId = await ctx.db.insert("image_edit_turns", {
            conversationId: args.conversationId,
            turnIndex: args.turnIndex,
            userMessage: args.userMessage,
            selectedModels: args.selectedModels,
            ...(args.selectedOutputIds && { selectedOutputIds: args.selectedOutputIds }),
            ...(args.manualReferenceIds && { manualReferenceIds: args.manualReferenceIds }),
            aspectRatio: args.aspectRatio,
            resolution: args.resolution,
            status: "generating",
            pendingModels: args.selectedModels,
            lastProgressAt: now,
            createdAt: now,
        });

        await syncConversationSummary(ctx, args.conversationId);
        return turnId;
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
        const turn = await ctx.db.get(args.id);
        if (!turn) return;

        await ctx.db.patch(args.id, {
            status: args.status,
            lastProgressAt: Date.now(),
            ...(args.pendingModels !== undefined && { pendingModels: args.pendingModels }),
        });

        await syncConversationSummary(ctx, turn.conversationId);
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
            lastProgressAt: Date.now(),
        });

        await syncConversationSummary(ctx, turn.conversationId);
    },
});

// Mark turn as error
export const markError = internalMutation({
    args: {
        id: v.id("image_edit_turns"),
    },
    handler: async (ctx, args) => {
        const turn = await ctx.db.get(args.id);
        if (!turn) return;

        await ctx.db.patch(args.id, {
            status: "error",
            pendingModels: [],
            lastProgressAt: Date.now(),
        });

        await syncConversationSummary(ctx, turn.conversationId);
    },
});
