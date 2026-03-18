import { v } from "convex/values";
import { mutation, query, internalQuery, type QueryCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import { coerceImageGenerationSettings } from "../lib/studio/imageGenerationCapabilities";

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
    conversation: {
        aspectRatio?: string;
        resolution?: string;
    }
): T & { aspectRatio: string; resolution: string } {
    return {
        ...turn,
        aspectRatio: turn.aspectRatio ?? conversation.aspectRatio ?? "1:1",
        resolution: turn.resolution ?? conversation.resolution ?? "standard",
    };
}

async function buildConversationSummary(
    ctx: QueryCtx,
    conversation: Doc<"image_edit_conversations">
) {
    const hasMaterializedSummary =
        conversation.turnCount !== undefined ||
        conversation.latestTurnId !== undefined ||
        conversation.latestOutputs !== undefined;

    if (!hasMaterializedSummary) {
        return buildConversationSummaryLegacy(ctx, conversation);
    }

    const sourceImageUrl = await ctx.storage.getUrl(conversation.sourceStorageId);
    const latestOutputs = await Promise.all(
        (conversation.latestOutputs ?? []).map(async (output) => ({
            _id: output.outputId,
            model: output.model,
            width: output.width,
            height: output.height,
            createdAt: output.createdAt,
            url: await ctx.storage.getUrl(output.storageId),
            ...(output.thumbnailStorageId
                ? { thumbnailUrl: await ctx.storage.getUrl(output.thumbnailStorageId) }
                : {}),
        }))
    );
    const fallbackThumbnailUrl =
        conversation.thumbnailStorageId
            ? await ctx.storage.getUrl(conversation.thumbnailStorageId)
            : sourceImageUrl;

    return {
        ...conversation,
        sourceImageUrl,
        thumbnailUrl: latestOutputs[0]?.url ?? fallbackThumbnailUrl,
        latestOutputUrl: latestOutputs[0]?.url ?? null,
        turnCount:
            conversation.turnCount ??
            (conversation.latestTurnIndex !== undefined
                ? conversation.latestTurnIndex + 1
                : 0),
        latestTurn: conversation.latestTurnId
            ? {
                  _id: conversation.latestTurnId,
                  userMessage: conversation.latestUserMessage ?? conversation.title,
                  aspectRatio: conversation.latestAspectRatio ?? conversation.aspectRatio ?? "1:1",
                  resolution: conversation.latestResolution ?? conversation.resolution ?? "standard",
                  status: conversation.latestStatus ?? "completed",
                  pendingModels: conversation.latestPendingModels ?? [],
                  outputs: latestOutputs,
              }
            : null,
    };
}

async function buildConversationSummaryLegacy(
    ctx: QueryCtx,
    conversation: Doc<"image_edit_conversations">
) {
    const sourceImageUrl = await ctx.storage.getUrl(conversation.sourceStorageId);
    const turns = await ctx.db
        .query("image_edit_turns")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
        .order("asc")
        .collect();

    const latestTurn = turns.at(-1) ?? null;
    const latestOutputs = latestTurn
        ? sortOutputsBySelectedModels(
              await Promise.all(
                  (
                      await ctx.db
                          .query("image_edit_outputs")
                          .withIndex("by_turn", (q) => q.eq("turnId", latestTurn._id))
                          .collect()
                  ).map(async (output) => ({
                      ...output,
                      url: await ctx.storage.getUrl(output.storageId),
                      ...(output.thumbnailStorageId
                          ? { thumbnailUrl: await ctx.storage.getUrl(output.thumbnailStorageId) }
                          : {}),
                  }))
              ),
              latestTurn.selectedModels
          )
        : [];

    return {
        ...conversation,
        sourceImageUrl,
        thumbnailUrl: latestOutputs[0]?.url ?? sourceImageUrl,
        latestOutputUrl: latestOutputs[0]?.url ?? null,
        turnCount: turns.length,
        latestTurn: latestTurn
            ? {
                  ...withTurnDefaults(latestTurn, conversation),
                  outputs: latestOutputs,
              }
            : null,
    };
}

async function expandConversation(
    ctx: QueryCtx,
    conversation: Doc<"image_edit_conversations">
) {
    const sourceImageUrl = await ctx.storage.getUrl(conversation.sourceStorageId);

    let sourceImage: Doc<"generated_images"> | null = null;
    if (conversation.sourceImageId) {
        sourceImage = await ctx.db.get(conversation.sourceImageId);
    }

    let sourceMedia: Doc<"media_items"> | null = null;
    if (conversation.sourceMediaId) {
        sourceMedia = await ctx.db.get(conversation.sourceMediaId);
    }

    let originalPost: Doc<"generated_posts"> | null = null;
    if (sourceImage) {
        originalPost = await ctx.db.get(sourceImage.generatedPostId);
    } else if (sourceMedia?.legacyPostId) {
        originalPost = await ctx.db.get(sourceMedia.legacyPostId);
    }

    return {
        ...conversation,
        sourceImageUrl,
        sourceImage,
        sourceMedia,
        originalPost,
    };
}

// Get a single conversation with source asset URL and original post data
export const get = query({
    args: {
        id: v.id("image_edit_conversations"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const conversation = await ctx.db.get(args.id);
        if (!conversation) {
            return null;
        }

        return expandConversation(ctx, conversation);
    },
});

export const getInternal = internalQuery({
    args: {
        id: v.id("image_edit_conversations"),
    },
    handler: async (ctx, args) => {
        const conversation = await ctx.db.get(args.id);
        if (!conversation) {
            return null;
        }

        return expandConversation(ctx, conversation);
    },
});

// List all conversations for the current user (not deleted)
export const listByUser = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return [];
        }

        const conversations = await ctx.db
            .query("image_edit_conversations")
            .withIndex("by_user_updated", (q) => q.eq("userId", user._id))
            .order("desc")
            .collect();

        const activeConversations = conversations.filter((conv) => !conv.deletedAt);
        return Promise.all(activeConversations.map((conversation) => buildConversationSummary(ctx, conversation)));
    },
});

export const listPendingByUser = query({
    args: {
        limit: v.optional(v.number()),
        staleAfterMs: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return [];
        }

        const limit = args.limit ?? 12;
        const staleAfterMs = args.staleAfterMs ?? 5 * 60 * 1000;
        const cutoff = Date.now() - staleAfterMs;

        const conversations = await ctx.db
            .query("image_edit_conversations")
            .withIndex("by_user_updated", (q) => q.eq("userId", user._id))
            .order("desc")
            .take(Math.max(limit * 4, 24));

        const pendingConversations = [];

        for (const conversation of conversations) {
            if (conversation.deletedAt) continue;
            let hydratedTurn:
                | {
                      _id: Id<"image_edit_turns">;
                      userMessage: string;
                      aspectRatio: string;
                      resolution: string;
                      status: string;
                      pendingModels: string[];
                      lastProgressAt: number;
                  }
                | null = null;

            if (conversation.latestTurnId !== undefined || conversation.latestStatus !== undefined) {
                if (!conversation.latestTurnId) continue;

                hydratedTurn = {
                    _id: conversation.latestTurnId,
                    userMessage: conversation.latestUserMessage ?? conversation.title,
                    aspectRatio: conversation.latestAspectRatio ?? conversation.aspectRatio ?? "1:1",
                    resolution: conversation.latestResolution ?? conversation.resolution ?? "standard",
                    status: conversation.latestStatus ?? "completed",
                    pendingModels: conversation.latestPendingModels ?? [],
                    lastProgressAt: conversation.latestProgressAt ?? conversation.updatedAt,
                };
            } else {
                const latestTurn = (
                    await ctx.db
                        .query("image_edit_turns")
                        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
                        .order("desc")
                        .take(1)
                )[0];

                if (!latestTurn) continue;

                const withDefaults = withTurnDefaults(latestTurn, conversation);
                hydratedTurn = {
                    _id: withDefaults._id,
                    userMessage: withDefaults.userMessage,
                    aspectRatio: withDefaults.aspectRatio,
                    resolution: withDefaults.resolution,
                    status: withDefaults.status,
                    pendingModels: withDefaults.pendingModels ?? [],
                    lastProgressAt: latestTurn.lastProgressAt ?? latestTurn.createdAt,
                };
            }

            const lastProgressAt = hydratedTurn.lastProgressAt;
            if (
                hydratedTurn.status !== "generating" ||
                hydratedTurn.pendingModels.length === 0 ||
                lastProgressAt < cutoff
            ) {
                continue;
            }

            pendingConversations.push({
                _id: conversation._id,
                title: conversation.title,
                updatedAt: conversation.updatedAt,
                latestTurn: {
                    _id: hydratedTurn._id,
                    userMessage: hydratedTurn.userMessage,
                    aspectRatio: hydratedTurn.aspectRatio,
                    resolution: hydratedTurn.resolution,
                    status: hydratedTurn.status,
                    pendingModels: hydratedTurn.pendingModels,
                },
            });

            if (pendingConversations.length >= limit) {
                break;
            }
        }

        return pendingConversations;
    },
});

export const cleanupStalePendingByUser = mutation({
    args: {
        staleAfterMs: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return 0;
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return 0;
        }

        const staleAfterMs = args.staleAfterMs ?? 5 * 60 * 1000;
        const cutoff = Date.now() - staleAfterMs;
        const conversations = await ctx.db
            .query("image_edit_conversations")
            .withIndex("by_user_updated", (q) => q.eq("userId", user._id))
            .order("desc")
            .collect();

        let cleaned = 0;

        for (const conversation of conversations) {
            if (conversation.deletedAt) continue;
            const latestTurnId = conversation.latestTurnId;
            const latestStatus = conversation.latestStatus;
            const pendingModels = conversation.latestPendingModels ?? [];
            const lastProgressAt = conversation.latestProgressAt ?? conversation.updatedAt;

            if (latestTurnId === undefined && latestStatus === undefined) {
                const latestTurn = (
                    await ctx.db
                        .query("image_edit_turns")
                        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
                        .order("desc")
                        .take(1)
                )[0];

                if (
                    latestTurn &&
                    latestTurn.status === "generating" &&
                    (latestTurn.pendingModels?.length ?? 0) > 0 &&
                    (latestTurn.lastProgressAt ?? latestTurn.createdAt) < cutoff
                ) {
                    await ctx.db.patch(latestTurn._id, {
                        status: "error",
                        pendingModels: [],
                        lastProgressAt: Date.now(),
                    });
                    cleaned += 1;
                }
                continue;
            }

            if (
                latestStatus === "generating" &&
                pendingModels.length > 0 &&
                latestTurnId &&
                lastProgressAt < cutoff
            ) {
                const now = Date.now();
                await ctx.db.patch(latestTurnId, {
                    status: "error",
                    pendingModels: [],
                    lastProgressAt: now,
                });
                await ctx.db.patch(conversation._id, {
                    latestStatus: "error",
                    latestPendingModels: [],
                    latestProgressAt: now,
                    updatedAt: now,
                });
                cleaned += 1;
            }
        }

        return cleaned;
    },
});

// Check if a conversation already exists for a source image
export const getBySourceImage = query({
    args: {
        sourceImageId: v.id("generated_images"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const conversation = await ctx.db
            .query("image_edit_conversations")
            .withIndex("by_source_image", (q) => q.eq("sourceImageId", args.sourceImageId))
            .first();

        return conversation;
    },
});

export const getBySourceMedia = query({
    args: {
        sourceMediaId: v.id("media_items"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const conversation = await ctx.db
            .query("image_edit_conversations")
            .withIndex("by_source_media", (q) => q.eq("sourceMediaId", args.sourceMediaId))
            .first();

        return conversation;
    },
});

// Create a new conversation
export const create = mutation({
    args: {
        sourceImageId: v.id("generated_images"),
        title: v.string(),
        aspectRatio: v.string(),
        resolution: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

        // Get source image to get storageId
        const sourceImage = await ctx.db.get(args.sourceImageId);
        if (!sourceImage) {
            throw new Error("Source image not found");
        }

        const now = Date.now();
        return await ctx.db.insert("image_edit_conversations", {
            userId: user._id,
            sourceImageId: args.sourceImageId,
            sourceStorageId: sourceImage.storageId,
            title: args.title,
            aspectRatio: args.aspectRatio,
            resolution: args.resolution,
            turnCount: 0,
            latestOutputCount: 0,
            latestOutputs: [],
            createdAt: now,
            updatedAt: now,
        });
    },
});

// Start a new conversation with first turn (synchronous - for immediate navigation)
// Image generation is triggered separately from the conversation page
export const startWithTurn = mutation({
    args: {
        sourceImageId: v.optional(v.id("generated_images")),
        sourceMediaId: v.optional(v.id("media_items")),
        userMessage: v.string(),
        selectedModels: v.array(v.string()),
        aspectRatio: v.optional(v.string()),
        resolution: v.optional(v.string()),
        manualReferenceIds: v.optional(v.array(v.id("_storage"))),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

        if (!args.sourceImageId && !args.sourceMediaId) {
            throw new Error("Source asset not found");
        }

        let sourceStorageId: Id<"_storage">;
        let defaultAspectRatio: string;
        let defaultResolution: string;

        if (args.sourceMediaId) {
            const sourceMedia = await ctx.db.get(args.sourceMediaId);
            if (!sourceMedia) {
                throw new Error("Source media not found");
            }

            sourceStorageId = sourceMedia.storageId;
            defaultAspectRatio = sourceMedia.aspectRatio ?? "1:1";
            defaultResolution = sourceMedia.resolution ?? "standard";
        } else {
            const sourceImage = await ctx.db.get(args.sourceImageId!);
            if (!sourceImage) {
                throw new Error("Source image not found");
            }

            sourceStorageId = sourceImage.storageId;
            defaultAspectRatio = sourceImage.aspectRatio ?? "1:1";
            defaultResolution = sourceImage.resolution ?? "standard";
        }

        const normalizedSettings = coerceImageGenerationSettings(
            args.selectedModels,
            args.aspectRatio ?? defaultAspectRatio,
            args.resolution ?? defaultResolution
        );
        const aspectRatio = normalizedSettings.aspectRatio;
        const resolution = normalizedSettings.resolution;

        const now = Date.now();

        // Generate title from first message
        const title = args.userMessage.trim().substring(0, 50) + (args.userMessage.length > 50 ? "..." : "");

        // Create conversation
        const conversationId = await ctx.db.insert("image_edit_conversations", {
            userId: user._id,
            ...(args.sourceImageId && { sourceImageId: args.sourceImageId }),
            ...(args.sourceMediaId && { sourceMediaId: args.sourceMediaId }),
            sourceStorageId,
            title,
            aspectRatio,
            resolution,
            turnCount: 1,
            latestOutputCount: 0,
            latestOutputs: [],
            createdAt: now,
            updatedAt: now,
        });

        // Create first turn
        const turnId = await ctx.db.insert("image_edit_turns", {
            conversationId,
            turnIndex: 0,
            userMessage: args.userMessage,
            selectedModels: args.selectedModels,
            ...(args.manualReferenceIds && { manualReferenceIds: args.manualReferenceIds }),
            aspectRatio,
            resolution,
            status: "generating",
            pendingModels: args.selectedModels,
            lastProgressAt: now,
            createdAt: now,
        });

        await ctx.db.patch(conversationId, {
            latestTurnId: turnId,
            latestTurnIndex: 0,
            latestUserMessage: args.userMessage,
            latestAspectRatio: aspectRatio,
            latestResolution: resolution,
            latestStatus: "generating",
            latestPendingModels: args.selectedModels,
            latestProgressAt: now,
        });

        return {
            conversationId,
            turnId,
            aspectRatio,
            resolution,
        };
    },
});

// Update conversation title
export const updateTitle = mutation({
    args: {
        id: v.id("image_edit_conversations"),
        title: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const conversation = await ctx.db.get(args.id);
        if (!conversation) {
            throw new Error("Conversation not found");
        }

        await ctx.db.patch(args.id, {
            title: args.title,
            updatedAt: Date.now(),
        });
    },
});

// Update conversation timestamp (called after each turn)
export const touch = mutation({
    args: {
        id: v.id("image_edit_conversations"),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            updatedAt: Date.now(),
        });
    },
});

// Soft delete (move to trash)
export const softDelete = mutation({
    args: {
        id: v.id("image_edit_conversations"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const conversation = await ctx.db.get(args.id);
        if (!conversation) {
            throw new Error("Conversation not found");
        }

        // Verify user owns it
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || conversation.userId !== user._id) {
            throw new Error("Not authorized");
        }

        await ctx.db.patch(args.id, {
            deletedAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

// Restore from trash
export const restore = mutation({
    args: {
        id: v.id("image_edit_conversations"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const conversation = await ctx.db.get(args.id);
        if (!conversation) {
            throw new Error("Conversation not found");
        }

        // Verify user owns it
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || conversation.userId !== user._id) {
            throw new Error("Not authorized");
        }

        await ctx.db.patch(args.id, {
            deletedAt: undefined,
            updatedAt: Date.now(),
        });
    },
});

// List conversations for a specific source image
export const listBySourceImage = query({
    args: {
        sourceImageId: v.id("generated_images"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return [];
        }

        const conversations = await ctx.db
            .query("image_edit_conversations")
            .withIndex("by_source_image", (q) => q.eq("sourceImageId", args.sourceImageId))
            .collect();

        const activeConversations = conversations.filter((conv) => !conv.deletedAt);
        return Promise.all(activeConversations.map((conversation) => buildConversationSummary(ctx, conversation)));
    },
});

export const listBySourceMedia = query({
    args: {
        sourceMediaId: v.id("media_items"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return [];
        }

        const conversations = await ctx.db
            .query("image_edit_conversations")
            .withIndex("by_source_media", (q) => q.eq("sourceMediaId", args.sourceMediaId))
            .collect();

        const activeConversations = conversations.filter((conv) => !conv.deletedAt);
        return Promise.all(activeConversations.map((conversation) => buildConversationSummary(ctx, conversation)));
    },
});

export const listRelatedToMedia = query({
    args: {
        mediaId: v.id("media_items"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return [];
        }

        const media = await ctx.db.get(args.mediaId);
        if (!media || media.userId !== user._id) {
            return [];
        }

        const related = new Map<Id<"image_edit_conversations">, Doc<"image_edit_conversations">>();
        const sourceConversations = await ctx.db
            .query("image_edit_conversations")
            .withIndex("by_source_media", (q) => q.eq("sourceMediaId", args.mediaId))
            .collect();

        for (const conversation of sourceConversations) {
            if (!conversation.deletedAt) {
                related.set(conversation._id, conversation);
            }
        }

        if (media.sourceConversationId) {
            const conversation = await ctx.db.get(media.sourceConversationId);
            if (conversation && !conversation.deletedAt && conversation.userId === user._id) {
                related.set(conversation._id, conversation);
            }
        }

        return Promise.all(
            [...related.values()]
                .sort((left, right) => right.updatedAt - left.updatedAt)
                .map((conversation) => buildConversationSummary(ctx, conversation))
        );
    },
});

// Delete a conversation and all its turns/outputs (hard delete)
export const remove = mutation({
    args: {
        id: v.id("image_edit_conversations"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const conversation = await ctx.db.get(args.id);
        if (!conversation) {
            throw new Error("Conversation not found");
        }

        // Delete all outputs for this conversation
        const outputs = await ctx.db
            .query("image_edit_outputs")
            .withIndex("by_conversation", (q) => q.eq("conversationId", args.id))
            .collect();

        for (const output of outputs) {
            // Delete the stored image
            await ctx.storage.delete(output.storageId);
            await ctx.db.delete(output._id);
        }

        // Delete all turns
        const turns = await ctx.db
            .query("image_edit_turns")
            .withIndex("by_conversation", (q) => q.eq("conversationId", args.id))
            .collect();

        for (const turn of turns) {
            await ctx.db.delete(turn._id);
        }

        // Delete the conversation
        await ctx.db.delete(args.id);
    },
});
