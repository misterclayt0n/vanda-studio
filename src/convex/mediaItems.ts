import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";

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
    url: string | null
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

async function resolveMediaCards(
    ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } },
    items: Doc<"media_items">[]
): Promise<MediaCard[]> {
    const urls = await Promise.all(items.map((item) => ctx.storage.getUrl(item.storageId)));
    return items.map((item, index) => toMediaCard(item, urls[index] ?? null));
}

// ============================================================================
// Internal Mutations (called by actions/migrations)
// ============================================================================

export const create = internalMutation({
    args: {
        userId: v.id("users"),
        projectId: v.optional(v.id("projects")),
        storageId: v.id("_storage"),
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
        return await ctx.db.insert("media_items", {
            userId: args.userId,
            ...(args.projectId && { projectId: args.projectId }),
            storageId: args.storageId,
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
        return await ctx.db.insert("media_items", {
            userId: user._id,
            ...(args.projectId && { projectId: args.projectId }),
            storageId: args.storageId,
            mimeType: args.mimeType,
            width: args.width,
            height: args.height,
            sourceType: "uploaded",
            createdAt: now,
            updatedAt: now,
        });
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

        const url = await ctx.storage.getUrl(item.storageId);

        return {
            ...item,
            url,
        };
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

        // Batch resolve storage URLs
        const urls = await Promise.all(
            visibleItems.map((item) => ctx.storage.getUrl(item.storageId))
        );

        const items = visibleItems.map((item, i) => ({
            ...item,
            url: urls[i] ?? null,
        }));

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

        const urls = await Promise.all(
            visibleItems.map((item) => ctx.storage.getUrl(item.storageId))
        );

        return visibleItems.map((item, i) => ({
            ...item,
            url: urls[i] ?? null,
        }));
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

        const urls = await Promise.all(
            items.map((item) => ctx.storage.getUrl(item.storageId))
        );

        return items.map((item, i) => ({
            ...item,
            url: urls[i] ?? null,
        }));
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

        const urls = await Promise.all(
            visibleItems.map((item) => ctx.storage.getUrl(item.storageId))
        );

        return visibleItems.map((item, index) => ({
            ...item,
            url: urls[index] ?? null,
        }));
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

        const urls = await Promise.all(
            visibleItems.map((item) => ctx.storage.getUrl(item.storageId))
        );

        return visibleItems.map((item, index) => ({
            ...item,
            url: urls[index] ?? null,
        }));
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

        const urls = await Promise.all(
            matched.map((item) => ctx.storage.getUrl(item.storageId))
        );

        return matched.map((item, i) => ({
            ...item,
            url: urls[i] ?? null,
        }));
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
