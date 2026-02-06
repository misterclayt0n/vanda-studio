import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// ============================================================================
// Types
// ============================================================================

const attachmentsValidator = v.optional(
    v.object({
        imageUrls: v.optional(v.array(v.string())),
        imageStorageIds: v.optional(v.array(v.id("_storage"))),
        instagramPostUrl: v.optional(v.string()),
        instagramPostCaption: v.optional(v.string()),
        referenceText: v.optional(v.string()),
    })
);

// ============================================================================
// Queries
// ============================================================================

/**
 * Get all messages for a generated post
 */
export const getMessages = query({
    args: {
        generatedPostId: v.id("generated_posts"),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("chat_messages")
            .withIndex("by_generated_post_id", (q) =>
                q.eq("generatedPostId", args.generatedPostId)
            )
            .order("asc")
            .collect();
    },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Save a chat message (internal use - called from actions)
 */
export const saveMessage = internalMutation({
    args: {
        generatedPostId: v.id("generated_posts"),
        role: v.string(),
        content: v.string(),
        action: v.optional(v.string()),
        snapshot: v.optional(
            v.object({
                caption: v.string(),
                imageStorageId: v.optional(v.id("_storage")),
                imagePrompt: v.optional(v.string()),
            })
        ),
        attachments: attachmentsValidator,
        model: v.optional(v.string()),
        imageModel: v.optional(v.string()),
        creditsUsed: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("chat_messages", {
            generatedPostId: args.generatedPostId,
            role: args.role,
            content: args.content,
            ...(args.action && { action: args.action }),
            ...(args.snapshot && { snapshot: args.snapshot }),
            ...(args.attachments && { attachments: args.attachments }),
            ...(args.model && { model: args.model }),
            ...(args.imageModel && { imageModel: args.imageModel }),
            ...(args.creditsUsed !== undefined && { creditsUsed: args.creditsUsed }),
            createdAt: Date.now(),
        });
    },
});

/**
 * Rollback to a previous state from a message snapshot
 */
export const rollback = mutation({
    args: {
        generatedPostId: v.id("generated_posts"),
        messageId: v.id("chat_messages"),
    },
    handler: async (ctx, args) => {
        // 1. Auth check
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Você precisa estar autenticado");
        }

        // 2. Get the message
        const message = await ctx.db.get(args.messageId);
        if (!message) {
            throw new Error("Mensagem não encontrada");
        }

        // 3. Verify it belongs to the correct post
        if (message.generatedPostId !== args.generatedPostId) {
            throw new Error("Mensagem não pertence a este post");
        }

        // 4. Check it has a snapshot
        if (!message.snapshot) {
            throw new Error("Esta mensagem não tem um estado para restaurar");
        }

        // 5. Update the post with the snapshot state
        await ctx.db.patch(args.generatedPostId, {
            caption: message.snapshot.caption,
            ...(message.snapshot.imageStorageId && {
                imageStorageId: message.snapshot.imageStorageId,
            }),
            ...(message.snapshot.imagePrompt && {
                imagePrompt: message.snapshot.imagePrompt,
            }),
            status: "regenerated",
            updatedAt: Date.now(),
        });

        // 6. Add system message noting the rollback
        await ctx.db.insert("chat_messages", {
            generatedPostId: args.generatedPostId,
            role: "system",
            content: "Estado restaurado para uma versao anterior.",
            createdAt: Date.now(),
        });

        return { success: true };
    },
});
