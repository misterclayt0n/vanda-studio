import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate upload URL for reference image
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

// Save reference image after upload
export const save = mutation({
    args: {
        projectId: v.id("projects"),
        storageId: v.id("_storage"),
        filename: v.string(),
        mimeType: v.string(),
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

        return await ctx.db.insert("reference_images", {
            projectId: args.projectId,
            storageId: args.storageId,
            filename: args.filename,
            mimeType: args.mimeType,
            createdAt: Date.now(),
        });
    },
});

// Update with analysis
export const updateAnalysis = mutation({
    args: {
        id: v.id("reference_images"),
        analysis: v.object({
            description: v.string(),
            dominantColors: v.array(v.string()),
            style: v.string(),
            mood: v.string(),
            elements: v.array(v.string()),
        }),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const image = await ctx.db.get(args.id);
        if (!image) {
            throw new Error("Reference image not found");
        }

        await ctx.db.patch(args.id, {
            analysis: args.analysis,
        });
    },
});

// List reference images for a project
export const listByProject = query({
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
            .query("reference_images")
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

// Delete a reference image
export const remove = mutation({
    args: {
        id: v.id("reference_images"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const image = await ctx.db.get(args.id);
        if (!image) {
            throw new Error("Reference image not found");
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
