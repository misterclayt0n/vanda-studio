import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// Create a new analysis record
export const createAnalysis = mutation({
    args: {
        projectId: v.id("projects"),
    },
    handler: async (ctx, args): Promise<Id<"brand_analysis">> => {
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
            throw new Error("Not authorized to analyze this project");
        }

        const analysisId = await ctx.db.insert("brand_analysis", {
            projectId: args.projectId,
            status: "pending",
            createdAt: Date.now(),
        });

        return analysisId;
    },
});

// Update analysis status
export const updateAnalysisStatus = mutation({
    args: {
        analysisId: v.id("brand_analysis"),
        status: v.string(),
        errorMessage: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const patch: Record<string, unknown> = { status: args.status };
        if (args.errorMessage !== undefined) {
            patch.errorMessage = args.errorMessage;
        }
        await ctx.db.patch(args.analysisId, patch);
    },
});

// Update brand analysis with results
export const updateBrandAnalysis = mutation({
    args: {
        analysisId: v.id("brand_analysis"),
        brandVoice: v.object({
            current: v.string(),
            recommended: v.string(),
            reasoning: v.string(),
            tone: v.array(v.string()),
        }),
        contentPillars: v.array(v.object({
            name: v.string(),
            description: v.string(),
            reasoning: v.string(),
        })),
        visualDirection: v.object({
            currentStyle: v.string(),
            recommendedStyle: v.string(),
            reasoning: v.string(),
        }),
        targetAudience: v.object({
            current: v.string(),
            recommended: v.string(),
            reasoning: v.string(),
        }),
        overallScore: v.number(),
        strategySummary: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.analysisId, {
            brandVoice: args.brandVoice,
            contentPillars: args.contentPillars,
            visualDirection: args.visualDirection,
            targetAudience: args.targetAudience,
            overallScore: args.overallScore,
            strategySummary: args.strategySummary,
        });
    },
});

// Create post analysis
export const createPostAnalysis = mutation({
    args: {
        projectId: v.id("projects"),
        analysisId: v.id("brand_analysis"),
        postId: v.id("instagram_posts"),
        currentCaption: v.optional(v.string()),
        suggestedCaption: v.string(),
        reasoning: v.string(),
        score: v.number(),
        improvements: v.array(v.object({
            type: v.string(),
            issue: v.string(),
            suggestion: v.string(),
        })),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("post_analysis", {
            projectId: args.projectId,
            analysisId: args.analysisId,
            postId: args.postId,
            currentCaption: args.currentCaption,
            suggestedCaption: args.suggestedCaption,
            reasoning: args.reasoning,
            score: args.score,
            improvements: args.improvements,
            createdAt: Date.now(),
        });
    },
});

// Get the latest analysis for a project
export const getLatestAnalysis = query({
    args: {
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        // Verify user owns the project
        const project = await ctx.db.get(args.projectId);
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

        // Get the most recent analysis
        const analyses = await ctx.db
            .query("brand_analysis")
            .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
            .order("desc")
            .take(1);

        return analyses[0] ?? null;
    },
});

// Get all analyses for a project (history)
export const listAnalyses = query({
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

        return await ctx.db
            .query("brand_analysis")
            .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
            .order("desc")
            .collect();
    },
});

// Get post analyses for an analysis
export const getPostAnalyses = query({
    args: {
        analysisId: v.id("brand_analysis"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        // Get the analysis to verify ownership
        const analysis = await ctx.db.get(args.analysisId);
        if (!analysis) {
            return [];
        }

        // Verify user owns the project
        const project = await ctx.db.get(analysis.projectId);
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
            .query("post_analysis")
            .withIndex("by_analysis_id", (q) => q.eq("analysisId", args.analysisId))
            .collect();
    },
});

// Get a single post's analysis
export const getPostAnalysis = query({
    args: {
        postId: v.id("instagram_posts"),
        analysisId: v.optional(v.id("brand_analysis")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        // Get the post to verify ownership
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

        // If analysisId is provided, get that specific analysis
        if (args.analysisId) {
            const analyses = await ctx.db
                .query("post_analysis")
                .withIndex("by_post_id", (q) => q.eq("postId", args.postId))
                .collect();

            return analyses.find((a) => a.analysisId === args.analysisId) ?? null;
        }

        // Otherwise get the most recent one
        const analyses = await ctx.db
            .query("post_analysis")
            .withIndex("by_post_id", (q) => q.eq("postId", args.postId))
            .order("desc")
            .take(1);

        return analyses[0] ?? null;
    },
});
