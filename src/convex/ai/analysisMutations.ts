import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

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
        // NEW: Visual identity extracted from actual images
        visualIdentity: v.optional(v.object({
            colorPalette: v.array(v.string()),
            layoutPatterns: v.array(v.string()),
            photographyStyle: v.string(),
            graphicElements: v.array(v.string()),
            filterTreatment: v.string(),
            dominantColors: v.optional(v.array(v.string())),
            consistencyScore: v.optional(v.number()),
        })),
        // NEW: Business category
        businessCategory: v.optional(v.string()),
        productOrService: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.analysisId, {
            brandVoice: args.brandVoice,
            contentPillars: args.contentPillars,
            visualDirection: args.visualDirection,
            targetAudience: args.targetAudience,
            overallScore: args.overallScore,
            strategySummary: args.strategySummary,
            visualIdentity: args.visualIdentity,
            businessCategory: args.businessCategory,
            productOrService: args.productOrService,
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

// List all post analyses for a project
export const listPostAnalyses = query({
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
            .query("post_analysis")
            .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
            .collect();
    },
});

// Create or update post analysis (for Analisar button)
export const upsertPostAnalysis = mutation({
    args: {
        projectId: v.id("projects"),
        postId: v.id("instagram_posts"),
        currentCaption: v.optional(v.string()),
        score: v.number(),
        analysisDetails: v.object({
            strengths: v.array(v.string()),
            weaknesses: v.array(v.string()),
            engagementPrediction: v.string(),
            hashtagAnalysis: v.string(),
            toneAnalysis: v.string(),
        }),
        reasoning: v.string(),
    },
    handler: async (ctx, args) => {
        // Check if analysis exists for this post
        const existing = await ctx.db
            .query("post_analysis")
            .withIndex("by_post_id", (q) => q.eq("postId", args.postId))
            .first();

        if (existing) {
            // Update existing
            await ctx.db.patch(existing._id, {
                currentCaption: args.currentCaption,
                hasAnalysis: true,
                score: args.score,
                analysisDetails: args.analysisDetails,
                reasoning: args.reasoning,
            });
            return existing._id;
        } else {
            // Create new
            return await ctx.db.insert("post_analysis", {
                projectId: args.projectId,
                postId: args.postId,
                currentCaption: args.currentCaption,
                hasAnalysis: true,
                score: args.score,
                analysisDetails: args.analysisDetails,
                reasoning: args.reasoning,
                createdAt: Date.now(),
            });
        }
    },
});

