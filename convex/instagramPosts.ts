import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const replaceForProject = mutation({
    args: {
        projectId: v.id("projects"),
        posts: v.array(
            v.object({
                instagramId: v.string(),
                caption: v.optional(v.string()),
                mediaUrl: v.string(),
                mediaType: v.string(),
                permalink: v.string(),
                timestamp: v.string(),
                likeCount: v.optional(v.number()),
                commentsCount: v.optional(v.number()),
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

        for (const post of args.posts) {
            await ctx.db.insert("instagram_posts", {
                projectId: args.projectId,
                ...post,
            });
        }
    },
});

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

        return await ctx.db
            .query("instagram_posts")
            .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
            .order("desc")
            .collect();
    },
});
