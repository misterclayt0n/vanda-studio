import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// Type for post with storage URLs
type CarouselImageWithUrl = {
    url: string;
    storageId?: Id<"_storage">;
    storageUrl?: string | null;
};

type PostWithStorageUrls = Doc<"instagram_posts"> & {
    mediaStorageUrl: string | null;
    thumbnailStorageUrl: string | null;
    carouselImagesWithUrls?: CarouselImageWithUrl[];
};

export const replaceForProject = mutation({
    args: {
        projectId: v.id("projects"),
        posts: v.array(
            v.object({
                instagramId: v.string(),
                caption: v.optional(v.string()),
                mediaUrl: v.string(),
                thumbnailUrl: v.optional(v.string()),
                mediaType: v.string(),
                permalink: v.string(),
                timestamp: v.string(),
                likeCount: v.optional(v.number()),
                commentsCount: v.optional(v.number()),
                carouselImages: v.optional(v.array(v.object({
                    url: v.string(),
                }))),
            }),
        ),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Called replaceForProject without authentication");
        }

        const project = await ctx.db.get(args.projectId);
        if (!project) {
            throw new Error("Project not found");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || project.userId !== user._id) {
            throw new Error("Not authorized to update posts for this project");
        }

        const existing = await ctx.db
            .query("instagram_posts")
            .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
            .collect();

        for (const post of existing) {
            await ctx.db.delete(post._id);
        }

        const insertedIds: Id<"instagram_posts">[] = [];
        for (const post of args.posts) {
            const id = await ctx.db.insert("instagram_posts", {
                projectId: args.projectId,
                ...post,
            });
            insertedIds.push(id);
        }

        return insertedIds;
    },
});

export const updateMediaStorage = mutation({
    args: {
        postId: v.id("instagram_posts"),
        mediaStorageId: v.optional(v.id("_storage")),
        thumbnailStorageId: v.optional(v.id("_storage")),
        carouselImages: v.optional(v.array(v.object({
            url: v.string(),
            storageId: v.optional(v.id("_storage")),
        }))),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Called updateMediaStorage without authentication");
        }

        const post = await ctx.db.get(args.postId);
        if (!post) {
            throw new Error("Post not found");
        }

        const project = await ctx.db.get(post.projectId);
        if (!project) {
            throw new Error("Project not found");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || project.userId !== user._id) {
            throw new Error("Not authorized to update this post");
        }

        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        const patch: Record<string, any> = {};
        if (args.mediaStorageId) patch.mediaStorageId = args.mediaStorageId;
        if (args.thumbnailStorageId) patch.thumbnailStorageId = args.thumbnailStorageId;
        if (args.carouselImages) patch.carouselImages = args.carouselImages;

        if (Object.keys(patch).length > 0) {
            await ctx.db.patch(args.postId, patch);
        }
    },
});

// Get a single post by ID
export const get = query({
    args: {
        postId: v.id("instagram_posts"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const post = await ctx.db.get(args.postId);
        if (!post) {
            return null;
        }

        const project = await ctx.db.get(post.projectId);
        if (!project) {
            return null;
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || project.userId !== user._id) {
            return null;
        }

        return post;
    },
});

export const listByProject = query({
    args: {
        projectId: v.id("projects"),
    },
    handler: async (ctx, args): Promise<PostWithStorageUrls[]> => {
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

        const posts = await ctx.db
            .query("instagram_posts")
            .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
            .order("desc")
            .collect();

        // Get storage URLs for media files
        const postsWithUrls: PostWithStorageUrls[] = await Promise.all(
            posts.map(async (post) => {
                let mediaStorageUrl: string | null = null;
                let thumbnailStorageUrl: string | null = null;

                if (post.mediaStorageId) {
                    mediaStorageUrl = await ctx.storage.getUrl(post.mediaStorageId);
                }
                if (post.thumbnailStorageId) {
                    thumbnailStorageUrl = await ctx.storage.getUrl(post.thumbnailStorageId);
                }

                // Get storage URLs for carousel images
                let carouselImagesWithUrls: CarouselImageWithUrl[] | undefined;
                if (post.carouselImages && post.carouselImages.length > 0) {
                    carouselImagesWithUrls = await Promise.all(
                        post.carouselImages.map(async (img) => {
                            let storageUrl: string | null = null;
                            if (img.storageId) {
                                storageUrl = await ctx.storage.getUrl(img.storageId);
                            }
                            return {
                                ...img,
                                storageUrl,
                            };
                        })
                    );
                }

                return {
                    ...post,
                    mediaStorageUrl,
                    thumbnailStorageUrl,
                    ...(carouselImagesWithUrls && { carouselImagesWithUrls }),
                };
            })
        );

        return postsWithUrls;
    },
});
