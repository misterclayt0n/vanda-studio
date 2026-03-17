import { v } from "convex/values";
import { query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

async function resolveOutputUrls(
    ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } },
    outputs: Array<{
        storageId: Id<"_storage">;
        thumbnailStorageId?: Id<"_storage">;
    }>
) {
    const uniqueStorageIds = [
        ...new Set(
            outputs.flatMap((output) => [output.storageId, output.thumbnailStorageId]).filter(
                (id): id is Id<"_storage"> => !!id
            )
        ),
    ];
    const urls = await Promise.all(uniqueStorageIds.map((storageId) => ctx.storage.getUrl(storageId)));
    return new Map(uniqueStorageIds.map((storageId, index) => [storageId, urls[index] ?? null]));
}

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

        const urlMap = await resolveOutputUrls(ctx, outputs);
        return outputs.map((output) => ({
            ...output,
            url: urlMap.get(output.storageId) ?? null,
            ...(output.thumbnailStorageId
                ? { thumbnailUrl: urlMap.get(output.thumbnailStorageId) ?? null }
                : {}),
        }));
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

        const urlMap = await resolveOutputUrls(ctx, outputs);
        return outputs.map((output) => ({
            ...output,
            url: urlMap.get(output.storageId) ?? null,
            ...(output.thumbnailStorageId
                ? { thumbnailUrl: urlMap.get(output.thumbnailStorageId) ?? null }
                : {}),
        }));
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

        const urlMap = await resolveOutputUrls(ctx, [output]);

        return {
            ...output,
            url: urlMap.get(output.storageId) ?? null,
            ...(output.thumbnailStorageId
                ? { thumbnailUrl: urlMap.get(output.thumbnailStorageId) ?? null }
                : {}),
        };
    },
});

export const listByIds = query({
    args: {
        ids: v.array(v.id("image_edit_outputs")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity || args.ids.length === 0) {
            return [];
        }

        const outputs = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
        const existingOutputs = outputs.filter(
            (output): output is NonNullable<typeof output> => !!output
        );

        const urlMap = await resolveOutputUrls(ctx, existingOutputs);
        return existingOutputs.map((output) => ({
            ...output,
            url: urlMap.get(output.storageId) ?? null,
            ...(output.thumbnailStorageId
                ? { thumbnailUrl: urlMap.get(output.thumbnailStorageId) ?? null }
                : {}),
        }));
    },
});

export const listByIdsInternal = internalQuery({
    args: {
        ids: v.array(v.id("image_edit_outputs")),
    },
    handler: async (ctx, args) => {
        if (args.ids.length === 0) {
            return [];
        }

        const outputs = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
        const existingOutputs = outputs.filter(
            (output): output is NonNullable<typeof output> => !!output
        );

        const urlMap = await resolveOutputUrls(ctx, existingOutputs);
        return existingOutputs.map((output) => ({
            ...output,
            url: urlMap.get(output.storageId) ?? null,
            ...(output.thumbnailStorageId
                ? { thumbnailUrl: urlMap.get(output.thumbnailStorageId) ?? null }
                : {}),
        }));
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
        thumbnailStorageId: v.optional(v.id("_storage")),
        mimeType: v.string(),
        model: v.string(),
        prompt: v.string(),
        userPrompt: v.optional(v.string()),
        generationDurationMs: v.optional(v.number()),
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
            ...(args.thumbnailStorageId && { thumbnailStorageId: args.thumbnailStorageId }),
            model: args.model,
            prompt: args.prompt,
            width: args.width,
            height: args.height,
            createdAt: now,
        });

        // 2. Create media_items entry (replaces synthetic post+image creation)
        const mediaItemId = await ctx.db.insert("media_items", {
            userId: args.userId,
            ...(args.projectId && { projectId: args.projectId }),
            storageId: args.storageId,
            ...(args.thumbnailStorageId && { thumbnailStorageId: args.thumbnailStorageId }),
            thumbnailStatus: args.thumbnailStorageId ? "ready" : "pending",
            thumbnailUpdatedAt: now,
            mimeType: args.mimeType,
            width: args.width,
            height: args.height,
            sourceType: "edited",
            model: args.model,
            prompt: args.prompt,
            ...(args.userPrompt && { userPrompt: args.userPrompt }),
            ...(args.generationDurationMs !== undefined
                ? { generationDurationMs: args.generationDurationMs }
                : {}),
            aspectRatio: args.aspectRatio,
            resolution: args.resolution,
            sourceConversationId: args.conversationId,
            sourceTurnId: args.turnId,
            sourceOutputId: outputId,
            createdAt: now,
            updatedAt: now,
        });

        if (!args.thumbnailStorageId) {
            await ctx.scheduler.runAfter(0, internal.mediaProcessing.generateThumbnailForMedia, {
                mediaItemId,
            });
        }

        return outputId;
    },
});

export const setThumbnail = internalMutation({
    args: {
        id: v.id("image_edit_outputs"),
        thumbnailStorageId: v.id("_storage"),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            thumbnailStorageId: args.thumbnailStorageId,
        });
    },
});
