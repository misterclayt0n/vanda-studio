import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate upload URL for context image
export const generateUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }
        return await ctx.storage.generateUploadUrl();
    },
});

// Add a context image to a project
export const add = mutation({
    args: {
        projectId: v.id("projects"),
        storageId: v.id("_storage"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // Verify user owns the project
        const project = await ctx.db.get(args.projectId);
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

        // Get storage URL for caching
        const storageUrl = await ctx.storage.getUrl(args.storageId);

        return await ctx.db.insert("context_images", {
            projectId: args.projectId,
            storageId: args.storageId,
            ...(storageUrl && { storageUrl }),
            createdAt: Date.now(),
        });
    },
});

// List context images for a project
export const list = query({
    args: {
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        // Verify user owns the project
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

        const images = await ctx.db
            .query("context_images")
            .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
            .order("desc")
            .collect();

        // Resolve storage URLs
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

// Remove a context image
export const remove = mutation({
    args: {
        id: v.id("context_images"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const image = await ctx.db.get(args.id);
        if (!image) {
            throw new Error("Context image not found");
        }

        // Verify user owns the project
        const project = await ctx.db.get(image.projectId);
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

        // Delete from storage
        await ctx.storage.delete(image.storageId);
        // Delete record
        await ctx.db.delete(args.id);
    },
});
