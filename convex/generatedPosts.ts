import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get a single generated post
export const get = query({
    args: {
        id: v.id("generated_posts"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const post = await ctx.db.get(args.id);
        if (!post) {
            return null;
        }

        // Verify user owns the project
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

// List all generated posts for a project
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

        const posts = await ctx.db
            .query("generated_posts")
            .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
            .order("desc")
            .collect();

        // Resolve image URLs
        return Promise.all(
            posts.map(async (post) => {
                let imageUrl: string | null = null;
                if (post.imageStorageId) {
                    imageUrl = await ctx.storage.getUrl(post.imageStorageId);
                }
                return {
                    ...post,
                    imageUrl,
                };
            })
        );
    },
});

// Get count of generated posts for a project
export const countByProject = query({
    args: {
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return 0;
        }

        const posts = await ctx.db
            .query("generated_posts")
            .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
            .collect();

        return posts.length;
    },
});

// Create a new generated post
export const create = mutation({
    args: {
        projectId: v.id("projects"),
        caption: v.string(),
        additionalContext: v.optional(v.string()),
        brandAnalysisId: v.id("brand_analysis"),
        sourcePostIds: v.array(v.id("instagram_posts")),
        reasoning: v.optional(v.string()),
        model: v.optional(v.string()),
        imageStorageId: v.optional(v.id("_storage")),
        imagePrompt: v.optional(v.string()),
        imageModel: v.optional(v.string()),
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

        const now = Date.now();
        return await ctx.db.insert("generated_posts", {
            projectId: args.projectId,
            caption: args.caption,
            additionalContext: args.additionalContext,
            brandAnalysisId: args.brandAnalysisId,
            sourcePostIds: args.sourcePostIds,
            reasoning: args.reasoning,
            model: args.model,
            imageStorageId: args.imageStorageId,
            imagePrompt: args.imagePrompt,
            imageModel: args.imageModel,
            status: "generated",
            createdAt: now,
            updatedAt: now,
        });
    },
});

// Update caption (for editing)
export const updateCaption = mutation({
    args: {
        id: v.id("generated_posts"),
        caption: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const post = await ctx.db.get(args.id);
        if (!post) {
            throw new Error("Generated post not found");
        }

        // Verify user owns the project
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

        await ctx.db.patch(args.id, {
            caption: args.caption,
            status: "edited",
            updatedAt: Date.now(),
        });
    },
});

// Update status after regeneration
export const updateRegenerated = mutation({
    args: {
        id: v.id("generated_posts"),
        caption: v.string(),
        reasoning: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const post = await ctx.db.get(args.id);
        if (!post) {
            throw new Error("Generated post not found");
        }

        await ctx.db.patch(args.id, {
            caption: args.caption,
            reasoning: args.reasoning,
            status: "regenerated",
            updatedAt: Date.now(),
        });
    },
});

// Check if context is ready for generation
export const checkContextReady = query({
    args: {
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return { hasStrategy: false, analyzedCount: 0, isReady: false, requiredPosts: 3 };
        }

        // Check brand analysis
        const brandAnalyses = await ctx.db
            .query("brand_analysis")
            .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
            .order("desc")
            .take(1);

        const latestAnalysis = brandAnalyses[0];
        const hasStrategy = latestAnalysis?.status === "completed" &&
            !!latestAnalysis.brandVoice &&
            !!latestAnalysis.targetAudience &&
            !!latestAnalysis.contentPillars;

        // Check post analyses
        const postAnalyses = await ctx.db
            .query("post_analysis")
            .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
            .collect();

        const analyzedCount = postAnalyses.filter((a) => a.hasAnalysis).length;
        const requiredPosts = 3;
        const isReady = hasStrategy && analyzedCount >= requiredPosts;

        return {
            hasStrategy,
            analyzedCount,
            isReady,
            requiredPosts,
        };
    },
});

// Delete a generated post
export const remove = mutation({
    args: {
        id: v.id("generated_posts"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const post = await ctx.db.get(args.id);
        if (!post) {
            throw new Error("Generated post not found");
        }

        // Verify user owns the project
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

        await ctx.db.delete(args.id);
    },
});
