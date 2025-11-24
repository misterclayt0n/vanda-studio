import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
    args: {
        name: v.string(),
        instagramUrl: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Called create project without authentication present");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

        const projectId = await ctx.db.insert("projects", {
            userId: user._id,
            name: args.name,
            instagramUrl: args.instagramUrl,
            isFetching: true,
            createdAt: Date.now(),
        });

        return projectId;
    },
});

export const list = query({
    args: {},
    handler: async (ctx) => {
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

        return await ctx.db
            .query("projects")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .collect();
    },
});

export const updateProfileData = mutation({
    args: {
        projectId: v.id("projects"),
        instagramHandle: v.optional(v.string()),
        profilePictureUrl: v.optional(v.string()),
        bio: v.optional(v.string()),
        followersCount: v.optional(v.number()),
        followingCount: v.optional(v.number()),
        postsCount: v.optional(v.number()),
        website: v.optional(v.string()),
        isFetching: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Called updateProfileData without authentication");
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
            throw new Error("Not authorized to update this project");
        }

        const patch: Record<string, unknown> = {};
        if (args.instagramHandle !== undefined) patch.instagramHandle = args.instagramHandle;
        if (args.profilePictureUrl !== undefined) patch.profilePictureUrl = args.profilePictureUrl;
        if (args.bio !== undefined) patch.bio = args.bio;
        if (args.followersCount !== undefined) patch.followersCount = args.followersCount;
        if (args.followingCount !== undefined) patch.followingCount = args.followingCount;
        if (args.postsCount !== undefined) patch.postsCount = args.postsCount;
        if (args.website !== undefined) patch.website = args.website;
        if (args.isFetching !== undefined) patch.isFetching = args.isFetching;

        if (Object.keys(patch).length === 0) {
            return project;
        }

        await ctx.db.patch(args.projectId, patch);
        return await ctx.db.get(args.projectId);
    },
});

export const get = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const project = await ctx.db.get(args.projectId);
        if (!project) return null;

        // Authorization check: Ensure the project belongs to the current user
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || project.userId !== user._id) {
            return null;
        }

        return project;
    },
});

export const remove = mutation({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Called remove project without authentication");
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
            throw new Error("Not authorized to delete this project");
        }

        const cleanupTables = ["instagram_posts", "brand_analysis", "content_calendar", "assets"] as const;
        for (const table of cleanupTables) {
            const docs = await ctx.db
                .query(table)
                .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
                .collect();
            for (const doc of docs) {
                await ctx.db.delete(doc._id);
            }
        }

        await ctx.db.delete(args.projectId);
    },
});
