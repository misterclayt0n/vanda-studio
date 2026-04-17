import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { DEFAULT_POST_MEDIA_MAX } from "../lib/data/postLimits";

// ============================================================================
// Mutations
// ============================================================================

// Add a media item to a post
export const addToPost = mutation({
    args: {
        postId: v.id("generated_posts"),
        mediaItemId: v.id("media_items"),
        position: v.number(),
        role: v.string(), // "cover" | "attachment"
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const post = await ctx.db.get(args.postId);
        if (!post) {
            throw new Error("Post not found");
        }

        const mediaItem = await ctx.db.get(args.mediaItemId);
        if (!mediaItem) {
            throw new Error("Media item not found");
        }

        return await ctx.db.insert("post_media_items", {
            postId: args.postId,
            mediaItemId: args.mediaItemId,
            position: args.position,
            role: args.role,
        });
    },
});

/**
 * Append many media items to an existing post at the end of the carousel.
 * - Ignores items already linked to the post.
 * - Caps the total at `maxPerPost` (default 10, matching Instagram carousel limits).
 * - Verifies the caller owns both the post and every media item.
 */
export const appendManyToPost = mutation({
    args: {
        postId: v.id("generated_posts"),
        mediaItemIds: v.array(v.id("media_items")),
    },
    handler: async (
        ctx,
        args
    ): Promise<{ added: number; skippedAlreadyLinked: number; skippedDueToLimit: number }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        if (args.mediaItemIds.length === 0) {
            return { added: 0, skippedAlreadyLinked: 0, skippedDueToLimit: 0 };
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();
        if (!user) {
            throw new Error("User not found");
        }

        const post = await ctx.db.get(args.postId);
        if (!post) {
            throw new Error("Post not found");
        }

        let hasAccess = post.userId === user._id;
        if (!hasAccess && post.projectId) {
            const project = await ctx.db.get(post.projectId);
            hasAccess = project?.userId === user._id;
        }
        if (!hasAccess) {
            throw new Error("Not authorized");
        }

        const existingLinks = await ctx.db
            .query("post_media_items")
            .withIndex("by_post", (q) => q.eq("postId", args.postId))
            .collect();
        const existingMediaIds = new Set(existingLinks.map((row) => row.mediaItemId));

        const remainingSlots = Math.max(0, DEFAULT_POST_MEDIA_MAX - existingLinks.length);

        let nextPosition = existingLinks.reduce(
            (max, row) => (row.position > max ? row.position : max),
            -1
        ) + 1;

        let added = 0;
        let skippedAlreadyLinked = 0;
        let skippedDueToLimit = 0;
        for (const mediaItemId of args.mediaItemIds) {
            if (existingMediaIds.has(mediaItemId)) {
                skippedAlreadyLinked += 1;
                continue;
            }
            if (added >= remainingSlots) {
                skippedDueToLimit += 1;
                continue;
            }
            const item = await ctx.db.get(mediaItemId);
            if (!item || item.userId !== user._id || item.deletedAt) continue;

            await ctx.db.insert("post_media_items", {
                postId: args.postId,
                mediaItemId,
                position: nextPosition,
                role: nextPosition === 0 ? "cover" : "attachment",
            });
            existingMediaIds.add(mediaItemId);
            nextPosition += 1;
            added += 1;
        }

        if (added > 0) {
            await ctx.db.patch(args.postId, { updatedAt: Date.now() });
        }

        return { added, skippedAlreadyLinked, skippedDueToLimit };
    },
});

// Remove a media item from a post
export const removeFromPost = mutation({
    args: {
        id: v.id("post_media_items"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const row = await ctx.db.get(args.id);
        if (!row) {
            throw new Error("Link not found");
        }

        await ctx.db.delete(args.id);
    },
});

// Reorder media items in a post
export const reorder = mutation({
    args: {
        postId: v.id("generated_posts"),
        orderedMediaItemIds: v.array(v.id("media_items")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const rows = await ctx.db
            .query("post_media_items")
            .withIndex("by_post", (q) => q.eq("postId", args.postId))
            .collect();

        for (const row of rows) {
            const newPosition = args.orderedMediaItemIds.indexOf(row.mediaItemId);
            if (newPosition !== -1 && newPosition !== row.position) {
                await ctx.db.patch(row._id, { position: newPosition });
            }
        }
    },
});

// ============================================================================
// Queries
// ============================================================================

// List media items for a post (with resolved URLs, ordered by position)
export const listByPost = query({
    args: {
        postId: v.id("generated_posts"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const rows = await ctx.db
            .query("post_media_items")
            .withIndex("by_post", (q) => q.eq("postId", args.postId))
            .collect();

        // Sort by position
        rows.sort((a, b) => a.position - b.position);

        // Fetch media items and resolve URLs
        const results = await Promise.all(
            rows.map(async (row) => {
                const mediaItem = await ctx.db.get(row.mediaItemId);
                if (!mediaItem) return null;

                const url = await ctx.storage.getUrl(mediaItem.storageId);

                return {
                    ...row,
                    mediaItem: {
                        ...mediaItem,
                        url,
                    },
                };
            })
        );

        return results.filter(Boolean);
    },
});

// List posts that reference a media item
export const listPostsForMedia = query({
    args: {
        mediaItemId: v.id("media_items"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const rows = await ctx.db
            .query("post_media_items")
            .withIndex("by_media", (q) => q.eq("mediaItemId", args.mediaItemId))
            .collect();

        const posts = await Promise.all(
            rows.map(async (row) => {
                const post = await ctx.db.get(row.postId);
                return post ? { ...row, post } : null;
            })
        );

        return posts.filter(Boolean);
    },
});

/**
 * Same as listPostsForMedia but enriched with everything needed to render a post
 * preview card in the media lightbox sidebar: cover URL, project name, platform,
 * scheduling, caption, media count.
 */
export const listPostsForMediaWithPreview = query({
    args: {
        mediaItemId: v.id("media_items"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const rows = await ctx.db
            .query("post_media_items")
            .withIndex("by_media", (q) => q.eq("mediaItemId", args.mediaItemId))
            .collect();

        const enriched = await Promise.all(
            rows.map(async (row) => {
                const post = await ctx.db.get(row.postId);
                if (!post || post.deletedAt) return null;

                // Cover = position 0 media of the post, falls back to this media.
                const allLinks = await ctx.db
                    .query("post_media_items")
                    .withIndex("by_post", (q) => q.eq("postId", post._id))
                    .collect();
                allLinks.sort((a, b) => a.position - b.position);

                const coverLink = allLinks[0] ?? row;
                const coverMedia = await ctx.db.get(coverLink.mediaItemId);
                const coverStorageId =
                    coverMedia?.thumbnailStorageId ?? coverMedia?.storageId ?? null;
                const coverUrl = coverStorageId
                    ? await ctx.storage.getUrl(coverStorageId)
                    : null;

                let projectName: string | undefined;
                if (post.projectId) {
                    const project = await ctx.db.get(post.projectId);
                    if (project) projectName = project.name;
                }

                return {
                    linkId: row._id,
                    position: row.position,
                    role: row.role,
                    post: {
                        _id: post._id,
                        title: post.title,
                        caption: post.caption,
                        platform: post.platform,
                        status: post.status,
                        updatedAt: post.updatedAt,
                        schedulingStatus: post.schedulingStatus,
                        scheduledFor: post.scheduledFor,
                        projectName,
                        mediaCount: allLinks.length,
                        coverUrl,
                    },
                };
            })
        );

        return enriched
            .filter((row): row is NonNullable<typeof row> => !!row)
            .sort((a, b) => b.post.updatedAt - a.post.updatedAt);
    },
});
