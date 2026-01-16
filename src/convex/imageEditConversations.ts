import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get a single conversation with source image URL and original post data
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

        // Get source image URL
        const sourceImageUrl = await ctx.storage.getUrl(conversation.sourceStorageId);

        // Get source image details
        const sourceImage = await ctx.db.get(conversation.sourceImageId);

        // Get original post data (for caption inheritance)
        let originalPost = null;
        if (sourceImage?.generatedPostId) {
            originalPost = await ctx.db.get(sourceImage.generatedPostId);
        }

        return {
            ...conversation,
            sourceImageUrl,
            sourceImage,
            originalPost,
        };
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
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .order("desc")
            .collect();

        // Filter out deleted and get source image URLs
        const activeConversations = conversations.filter((conv) => !conv.deletedAt);

        return Promise.all(
            activeConversations.map(async (conv) => {
                const sourceImageUrl = await ctx.storage.getUrl(conv.sourceStorageId);
                
                // Get latest output for preview
                const outputs = await ctx.db
                    .query("image_edit_outputs")
                    .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
                    .order("desc")
                    .take(1);
                
                let latestOutputUrl: string | null = null;
                const latestOutput = outputs[0];
                if (latestOutput) {
                    latestOutputUrl = await ctx.storage.getUrl(latestOutput.storageId);
                }

                // Get turn count
                const turns = await ctx.db
                    .query("image_edit_turns")
                    .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
                    .collect();

                return {
                    ...conv,
                    sourceImageUrl,
                    latestOutputUrl,
                    turnCount: turns.length,
                };
            })
        );
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
            createdAt: now,
            updatedAt: now,
        });
    },
});

// Start a new conversation with first turn (synchronous - for immediate navigation)
// Image generation is triggered separately from the conversation page
export const startWithTurn = mutation({
    args: {
        sourceImageId: v.id("generated_images"),
        userMessage: v.string(),
        selectedModels: v.array(v.string()),
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

        // Get source image
        const sourceImage = await ctx.db.get(args.sourceImageId);
        if (!sourceImage) {
            throw new Error("Source image not found");
        }

        const now = Date.now();

        // Generate title from first message
        const title = args.userMessage.trim().substring(0, 50) + (args.userMessage.length > 50 ? "..." : "");

        // Create conversation
        const conversationId = await ctx.db.insert("image_edit_conversations", {
            userId: user._id,
            sourceImageId: args.sourceImageId,
            sourceStorageId: sourceImage.storageId,
            title,
            aspectRatio: sourceImage.aspectRatio,
            resolution: sourceImage.resolution,
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
            status: "generating",
            pendingModels: args.selectedModels,
            createdAt: now,
        });

        return {
            conversationId,
            turnId,
            aspectRatio: sourceImage.aspectRatio,
            resolution: sourceImage.resolution,
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

        // Filter out deleted and enrich with turn counts and thumbnails
        const activeConversations = conversations.filter((conv) => !conv.deletedAt);

        return Promise.all(
            activeConversations.map(async (conv) => {
                // Get turn count
                const turns = await ctx.db
                    .query("image_edit_turns")
                    .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
                    .collect();

                // Get latest output for thumbnail
                const latestOutput = await ctx.db
                    .query("image_edit_outputs")
                    .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
                    .order("desc")
                    .first();

                let thumbnailUrl: string | null = null;
                if (latestOutput) {
                    thumbnailUrl = await ctx.storage.getUrl(latestOutput.storageId);
                } else {
                    thumbnailUrl = await ctx.storage.getUrl(conv.sourceStorageId);
                }

                return {
                    ...conv,
                    turnCount: turns.length,
                    thumbnailUrl,
                };
            })
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
