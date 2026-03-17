import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";

type MediaCard = Pick<
    Doc<"media_items">,
    | "_id"
    | "_creationTime"
    | "storageId"
    | "mimeType"
    | "sourceType"
    | "width"
    | "height"
    | "createdAt"
> & {
    url: string | null;
    thumbnailUrl?: string | null;
    model?: string;
    prompt?: string;
    userPrompt?: string;
    generationDurationMs?: number;
    aspectRatio?: string;
    resolution?: string;
    projectId?: Id<"projects">;
    batchId?: Id<"media_generation_batches">;
    sourceConversationId?: Id<"image_edit_conversations">;
    sourceTurnId?: Id<"image_edit_turns">;
    sourceOutputId?: Id<"image_edit_outputs">;
};

function toMediaCard(
    item: Doc<"media_items">,
    url: string | null,
    thumbnailUrl?: string | null
): MediaCard {
    return {
        _id: item._id,
        _creationTime: item._creationTime,
        storageId: item.storageId,
        mimeType: item.mimeType,
        sourceType: item.sourceType,
        width: item.width,
        height: item.height,
        createdAt: item.createdAt,
        url,
        ...(thumbnailUrl !== undefined ? { thumbnailUrl } : {}),
        ...(item.model && { model: item.model }),
        ...(item.prompt && { prompt: item.prompt }),
        ...(item.userPrompt && { userPrompt: item.userPrompt }),
        ...(item.generationDurationMs !== undefined
            ? { generationDurationMs: item.generationDurationMs }
            : {}),
        ...(item.aspectRatio && { aspectRatio: item.aspectRatio }),
        ...(item.resolution && { resolution: item.resolution }),
        ...(item.projectId && { projectId: item.projectId }),
        ...(item.batchId && { batchId: item.batchId }),
        ...(item.sourceConversationId && { sourceConversationId: item.sourceConversationId }),
        ...(item.sourceTurnId && { sourceTurnId: item.sourceTurnId }),
        ...(item.sourceOutputId && { sourceOutputId: item.sourceOutputId }),
    };
}

async function resolveStorageUrlMap(
    ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } },
    storageIds: Array<Id<"_storage"> | undefined>
) {
    const uniqueStorageIds = [...new Set(storageIds.filter((id): id is Id<"_storage"> => !!id))];
    const urls = await Promise.all(uniqueStorageIds.map((storageId) => ctx.storage.getUrl(storageId)));
    return new Map(uniqueStorageIds.map((storageId, index) => [storageId, urls[index] ?? null]));
}

async function resolveMediaCards(
    ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } },
    items: Doc<"media_items">[]
): Promise<MediaCard[]> {
    const urlMap = await resolveStorageUrlMap(
        ctx,
        items.flatMap((item) => [item.storageId, item.thumbnailStorageId])
    );

    return items.map((item) =>
        toMediaCard(
            item,
            urlMap.get(item.storageId) ?? null,
            item.thumbnailStorageId ? (urlMap.get(item.thumbnailStorageId) ?? null) : null
        )
    );
}

async function resolveMediaItems(
    ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } },
    items: Doc<"media_items">[]
) {
    const urlMap = await resolveStorageUrlMap(
        ctx,
        items.flatMap((item) => [item.storageId, item.thumbnailStorageId])
    );

    return items.map((item) => ({
        ...item,
        url: urlMap.get(item.storageId) ?? null,
        ...(item.thumbnailStorageId
            ? { thumbnailUrl: urlMap.get(item.thumbnailStorageId) ?? null }
            : {}),
    }));
}

async function scheduleThumbnailGeneration(
    ctx: {
        scheduler: {
            runAfter: (
                delayMs: number,
                fn: typeof internal.mediaProcessing.generateThumbnailForMedia,
                args: { mediaItemId: Id<"media_items"> }
            ) => Promise<unknown>;
        };
        db: {
            patch: (
                id: Id<"media_items">,
                value: Partial<Doc<"media_items">>
            ) => Promise<void>;
        };
    },
    mediaItemId: Id<"media_items">
) {
    try {
        await ctx.scheduler.runAfter(0, internal.mediaProcessing.generateThumbnailForMedia, {
            mediaItemId,
        });
    } catch (error) {
        console.error("[MEDIA_ITEMS] Failed to schedule thumbnail generation:", error);
        await ctx.db.patch(mediaItemId, {
            thumbnailStatus: "error",
            thumbnailUpdatedAt: Date.now(),
            updatedAt: Date.now(),
        });
    }
}

// ============================================================================
// Internal Mutations (called by actions/migrations)
// ============================================================================

export const create = internalMutation({
    args: {
        userId: v.id("users"),
        projectId: v.optional(v.id("projects")),
        storageId: v.id("_storage"),
        thumbnailStorageId: v.optional(v.id("_storage")),
        mimeType: v.string(),
        width: v.number(),
        height: v.number(),
        sourceType: v.string(),
        model: v.optional(v.string()),
        prompt: v.optional(v.string()),
        userPrompt: v.optional(v.string()),
        generationDurationMs: v.optional(v.number()),
        aspectRatio: v.optional(v.string()),
        resolution: v.optional(v.string()),
        parentMediaId: v.optional(v.id("media_items")),
        sourceConversationId: v.optional(v.id("image_edit_conversations")),
        sourceTurnId: v.optional(v.id("image_edit_turns")),
        sourceOutputId: v.optional(v.id("image_edit_outputs")),
        batchId: v.optional(v.id("media_generation_batches")),
        legacyGeneratedImageId: v.optional(v.id("generated_images")),
        legacyPostId: v.optional(v.id("generated_posts")),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
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
            sourceType: args.sourceType,
            ...(args.model && { model: args.model }),
            ...(args.prompt && { prompt: args.prompt }),
            ...(args.userPrompt && { userPrompt: args.userPrompt }),
            ...(args.generationDurationMs !== undefined
                ? { generationDurationMs: args.generationDurationMs }
                : {}),
            ...(args.aspectRatio && { aspectRatio: args.aspectRatio }),
            ...(args.resolution && { resolution: args.resolution }),
            ...(args.parentMediaId && { parentMediaId: args.parentMediaId }),
            ...(args.sourceConversationId && { sourceConversationId: args.sourceConversationId }),
            ...(args.sourceTurnId && { sourceTurnId: args.sourceTurnId }),
            ...(args.sourceOutputId && { sourceOutputId: args.sourceOutputId }),
            ...(args.batchId && { batchId: args.batchId }),
            ...(args.legacyGeneratedImageId && { legacyGeneratedImageId: args.legacyGeneratedImageId }),
            ...(args.legacyPostId && { legacyPostId: args.legacyPostId }),
            createdAt: now,
            updatedAt: now,
        });

        if (!args.thumbnailStorageId) {
            await scheduleThumbnailGeneration(ctx, mediaItemId);
        }

        return mediaItemId;
    },
});

export const getInternal = internalQuery({
    args: {
        id: v.id("media_items"),
    },
    handler: async (ctx, args) => {
        return ctx.db.get(args.id);
    },
});

export const setThumbnailReady = internalMutation({
    args: {
        id: v.id("media_items"),
        thumbnailStorageId: v.id("_storage"),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            thumbnailStorageId: args.thumbnailStorageId,
            thumbnailStatus: "ready",
            thumbnailUpdatedAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

export const setThumbnailError = internalMutation({
    args: {
        id: v.id("media_items"),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            thumbnailStatus: "error",
            thumbnailUpdatedAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

// ============================================================================
// Mutations (user-facing)
// ============================================================================

// Upload a new image to the media library
export const createUploaded = mutation({
    args: {
        storageId: v.id("_storage"),
        mimeType: v.string(),
        width: v.number(),
        height: v.number(),
        projectId: v.optional(v.id("projects")),
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

        if (args.projectId) {
            const project = await ctx.db.get(args.projectId);
            if (!project || project.userId !== user._id) {
                throw new Error("Not authorized");
            }
        }

        const now = Date.now();
        const mediaItemId = await ctx.db.insert("media_items", {
            userId: user._id,
            ...(args.projectId && { projectId: args.projectId }),
            storageId: args.storageId,
            thumbnailStatus: "pending",
            thumbnailUpdatedAt: now,
            mimeType: args.mimeType,
            width: args.width,
            height: args.height,
            sourceType: "uploaded",
            createdAt: now,
            updatedAt: now,
        });

        await scheduleThumbnailGeneration(ctx, mediaItemId);
        return mediaItemId;
    },
});

// Soft delete
export const softDelete = mutation({
    args: {
        id: v.id("media_items"),
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

        const item = await ctx.db.get(args.id);
        if (!item || item.userId !== user._id) {
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
        id: v.id("media_items"),
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

        const item = await ctx.db.get(args.id);
        if (!item || item.userId !== user._id) {
            throw new Error("Not authorized");
        }

        await ctx.db.patch(args.id, {
            deletedAt: undefined,
            updatedAt: Date.now(),
        });
    },
});

// Move to different project
export const updateProject = mutation({
    args: {
        id: v.id("media_items"),
        projectId: v.optional(v.id("projects")),
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

        const item = await ctx.db.get(args.id);
        if (!item || item.userId !== user._id) {
            throw new Error("Not authorized");
        }

        if (args.projectId) {
            const project = await ctx.db.get(args.projectId);
            if (!project || project.userId !== user._id) {
                throw new Error("Not authorized");
            }
        }

        await ctx.db.patch(args.id, {
            projectId: args.projectId,
            updatedAt: Date.now(),
        });
    },
});

export const ensureThumbnails = mutation({
    args: {
        ids: v.array(v.id("media_items")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity || args.ids.length === 0) {
            return 0;
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return 0;
        }

        let scheduled = 0;
        const uniqueIds = [...new Set(args.ids)];

        for (const id of uniqueIds) {
            const item = await ctx.db.get(id);
            if (!item || item.userId !== user._id || item.deletedAt || item.thumbnailStorageId) {
                continue;
            }

            if (item.thumbnailStatus === "pending") {
                continue;
            }

            const now = Date.now();
            await ctx.db.patch(id, {
                thumbnailStatus: "pending",
                thumbnailUpdatedAt: now,
                updatedAt: now,
            });
            await scheduleThumbnailGeneration(ctx, id);
            scheduled += 1;
        }

        return scheduled;
    },
});

// ============================================================================
// Queries
// ============================================================================

// Get a single media item with resolved URL
export const get = query({
    args: {
        id: v.id("media_items"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const item = await ctx.db.get(args.id);
        if (!item) {
            return null;
        }

        return (await resolveMediaItems(ctx, [item]))[0] ?? null;
    },
});

// List media items for current user (paginated, sorted by createdAt desc)
export const listByUser = query({
    args: {
        cursor: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return { items: [], nextCursor: null, hasMore: false };
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return { items: [], nextCursor: null, hasMore: false };
        }

        const limit = args.limit ?? 30;
        const result = await ctx.db
            .query("media_items")
            .withIndex("by_user_created", (q) => q.eq("userId", user._id))
            .order("desc")
            .paginate({ cursor: args.cursor ?? null, numItems: limit });

        const visibleItems = result.page.filter((item) => !item.deletedAt);

        const items = await resolveMediaItems(ctx, visibleItems);

        return {
            items,
            nextCursor: result.continueCursor,
            hasMore: !result.isDone,
        };
    },
});

export const listCardsByUser = query({
    args: {
        cursor: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return { items: [], nextCursor: null, hasMore: false };
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return { items: [], nextCursor: null, hasMore: false };
        }

        const limit = args.limit ?? 30;
        const result = await ctx.db
            .query("media_items")
            .withIndex("by_user_created", (q) => q.eq("userId", user._id))
            .order("desc")
            .paginate({ cursor: args.cursor ?? null, numItems: limit });

        const visibleItems = result.page.filter((item) => !item.deletedAt);

        return {
            items: await resolveMediaCards(ctx, visibleItems),
            nextCursor: result.continueCursor,
            hasMore: !result.isDone,
        };
    },
});

// List media items for a project
export const listByProject = query({
    args: {
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const project = await ctx.db.get(args.projectId);
        if (!project) {
            return [];
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || project.userId !== user._id) {
            return [];
        }

        const items = await ctx.db
            .query("media_items")
            .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
            .order("desc")
            .collect();

        const visibleItems = items.filter((item) => !item.deletedAt);

        return resolveMediaItems(ctx, visibleItems);
    },
});

export const listCardsByProject = query({
    args: {
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const project = await ctx.db.get(args.projectId);
        if (!project) {
            return [];
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || project.userId !== user._id) {
            return [];
        }

        const items = await ctx.db
            .query("media_items")
            .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
            .order("desc")
            .collect();

        return resolveMediaCards(
            ctx,
            items.filter((item) => !item.deletedAt)
        );
    },
});

// List media items for a generation batch
export const listByBatch = query({
    args: {
        batchId: v.id("media_generation_batches"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const items = await ctx.db
            .query("media_items")
            .withIndex("by_batch", (q) => q.eq("batchId", args.batchId))
            .order("desc")
            .collect();

        return resolveMediaItems(ctx, items);
    },
});

// Get multiple media items by ID, preserving input order
export const listByIds = query({
    args: {
        ids: v.array(v.id("media_items")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity || args.ids.length === 0) {
            return [];
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return [];
        }

        const items = await Promise.all(args.ids.map((id) => ctx.db.get(id)));

        const visibleItems = items.filter(
            (item): item is NonNullable<typeof item> =>
                !!item && item.userId === user._id && !item.deletedAt
        );

        return resolveMediaItems(ctx, visibleItems);
    },
});

export const listBySourceOutputIds = query({
    args: {
        outputIds: v.array(v.id("image_edit_outputs")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity || args.outputIds.length === 0) {
            return [];
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return [];
        }

        const items = await Promise.all(
            args.outputIds.map((outputId) =>
                ctx.db
                    .query("media_items")
                    .withIndex("by_source_output", (q) => q.eq("sourceOutputId", outputId))
                    .first()
            )
        );

        const visibleItems = items.filter(
            (item): item is NonNullable<typeof item> =>
                !!item && item.userId === user._id && !item.deletedAt
        );

        return resolveMediaItems(ctx, visibleItems);
    },
});

// Search media items by prompt text
export const search = query({
    args: {
        query: v.string(),
        limit: v.optional(v.number()),
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

        const searchTerm = args.query.toLowerCase();
        const limit = args.limit ?? 20;

        const allItems = await ctx.db
            .query("media_items")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .collect();

        const matched = allItems
            .filter((item) => !item.deletedAt)
            .filter(
                (item) =>
                    item.prompt?.toLowerCase().includes(searchTerm) ||
                    item.userPrompt?.toLowerCase().includes(searchTerm)
            )
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, limit);

        return resolveMediaItems(ctx, matched);
    },
});

export const searchCards = query({
    args: {
        query: v.string(),
        limit: v.optional(v.number()),
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

        const searchTerm = args.query.trim().toLowerCase();
        if (!searchTerm) {
            return [];
        }

        const limit = args.limit ?? 20;
        const scanLimit = Math.max(limit * 15, 150);

        const recentItems = await ctx.db
            .query("media_items")
            .withIndex("by_user_created", (q) => q.eq("userId", user._id))
            .order("desc")
            .take(scanLimit);

        const matched = recentItems
            .filter((item) => !item.deletedAt)
            .filter((item) => {
                const promptMatch = item.prompt?.toLowerCase().includes(searchTerm) ?? false;
                const userPromptMatch = item.userPrompt?.toLowerCase().includes(searchTerm) ?? false;
                const modelMatch = item.model?.toLowerCase().includes(searchTerm) ?? false;
                const sourceMatch = item.sourceType.toLowerCase().includes(searchTerm);
                return promptMatch || userPromptMatch || modelMatch || sourceMatch;
            })
            .slice(0, limit);

        return resolveMediaCards(ctx, matched);
    },
});
