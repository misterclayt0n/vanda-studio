import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
