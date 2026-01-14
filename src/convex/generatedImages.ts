import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a new generated image record
export const create = mutation({
    args: {
        generatedPostId: v.id("generated_posts"),
        storageId: v.id("_storage"),
        model: v.string(),
        aspectRatio: v.string(),
        resolution: v.string(),
        prompt: v.string(),
        width: v.number(),
        height: v.number(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // Verify the post exists
        const post = await ctx.db.get(args.generatedPostId);
        if (!post) {
            throw new Error("Generated post not found");
        }

        return await ctx.db.insert("generated_images", {
            generatedPostId: args.generatedPostId,
            storageId: args.storageId,
            model: args.model,
            aspectRatio: args.aspectRatio,
            resolution: args.resolution,
            prompt: args.prompt,
            width: args.width,
            height: args.height,
            createdAt: Date.now(),
        });
    },
});

// List all images for a generated post with resolved URLs
export const listByPost = query({
    args: {
        generatedPostId: v.id("generated_posts"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        // Verify the post exists and user has access
        const post = await ctx.db.get(args.generatedPostId);
        if (!post) {
            return [];
        }

        // If post has a project, verify user owns it
        if (post.projectId) {
            const project = await ctx.db.get(post.projectId);
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
        }

        const images = await ctx.db
            .query("generated_images")
            .withIndex("by_generated_post_id", (q) => q.eq("generatedPostId", args.generatedPostId))
            .collect();

        // Resolve URLs
        return Promise.all(
            images.map(async (image) => {
                const url = await ctx.storage.getUrl(image.storageId);
                return {
                    ...image,
                    url,
                };
            })
        );
    },
});

// Get a single image with resolved URL
export const get = query({
    args: {
        id: v.id("generated_images"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const image = await ctx.db.get(args.id);
        if (!image) {
            return null;
        }

        // Verify the post exists and user has access
        const post = await ctx.db.get(image.generatedPostId);
        if (!post) {
            return null;
        }

        // If post has a project, verify user owns it
        if (post.projectId) {
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
        }

        const url = await ctx.storage.getUrl(image.storageId);

        return {
            ...image,
            url,
        };
    },
});

// Delete a generated image
export const remove = mutation({
    args: {
        id: v.id("generated_images"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const image = await ctx.db.get(args.id);
        if (!image) {
            throw new Error("Image not found");
        }

        // Verify the post exists and user has access
        const post = await ctx.db.get(image.generatedPostId);
        if (!post) {
            throw new Error("Generated post not found");
        }

        // If post has a project, verify user owns it
        if (post.projectId) {
            const project = await ctx.db.get(post.projectId);
            if (!project) {
                throw new Error("Project not found");
            }

            const user = await ctx.db
                .query("users")
                .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
                .unique();

            if (!user || project.userId !== user._id) {
                throw new Error("Not authorized");
            }
        }

        // Delete from storage
        await ctx.storage.delete(image.storageId);

        // Delete from database
        await ctx.db.delete(args.id);
    },
});
