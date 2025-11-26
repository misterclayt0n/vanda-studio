import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    users: defineTable({
        name: v.string(),
        email: v.string(),
        clerkId: v.string(),
        imageUrl: v.optional(v.string()),
    }).index("by_clerk_id", ["clerkId"]),

    projects: defineTable({
        userId: v.id("users"),
        name: v.string(), // e.g. "Vanda Studio"
        instagramUrl: v.string(),
        instagramHandle: v.optional(v.string()),
        profilePictureUrl: v.optional(v.string()),
        profilePictureStorageId: v.optional(v.id("_storage")),
        bio: v.optional(v.string()),
        followersCount: v.optional(v.number()),
        followingCount: v.optional(v.number()),
        postsCount: v.optional(v.number()),
        website: v.optional(v.string()),
        isFetching: v.optional(v.boolean()),
        createdAt: v.number(),
    }).index("by_user_id", ["userId"]),

    instagram_posts: defineTable({
        projectId: v.id("projects"),
        instagramId: v.string(), // The IG post ID
        caption: v.optional(v.string()),
        mediaUrl: v.string(),
        mediaStorageId: v.optional(v.id("_storage")),
        thumbnailUrl: v.optional(v.string()),
        thumbnailStorageId: v.optional(v.id("_storage")),
        mediaType: v.string(), // IMAGE, VIDEO, CAROUSEL_ALBUM
        permalink: v.string(),
        timestamp: v.string(), // ISO string from IG
        likeCount: v.optional(v.number()),
        commentsCount: v.optional(v.number()),
        // Carousel/Sidecar child images
        carouselImages: v.optional(v.array(v.object({
            url: v.string(),
            storageId: v.optional(v.id("_storage")),
        }))),
        // Analysis fields (can be filled later)
        analysis: v.optional(v.any()),
    }).index("by_project_id", ["projectId"]),

    // User subscription & quota tracking
    user_subscriptions: defineTable({
        userId: v.id("users"),
        plan: v.string(), // "free" | "pro"
        promptsLimit: v.number(),
        promptsUsed: v.number(),
        periodStart: v.number(),
        periodEnd: v.number(),
        createdAt: v.number(),
    }).index("by_user_id", ["userId"]),

    // AI brand analysis results
    brand_analysis: defineTable({
        projectId: v.id("projects"),
        status: v.string(), // "pending" | "processing" | "completed" | "failed"
        brandVoice: v.optional(v.object({
            current: v.string(),
            recommended: v.string(),
            reasoning: v.string(),
            tone: v.array(v.string()),
        })),
        contentPillars: v.optional(v.array(v.object({
            name: v.string(),
            description: v.string(),
            reasoning: v.string(),
        }))),
        visualDirection: v.optional(v.object({
            currentStyle: v.string(),
            recommendedStyle: v.string(),
            reasoning: v.string(),
        })),
        targetAudience: v.optional(v.object({
            current: v.string(),
            recommended: v.string(),
            reasoning: v.string(),
        })),
        overallScore: v.optional(v.number()),
        strategySummary: v.optional(v.string()),
        errorMessage: v.optional(v.string()),
        createdAt: v.number(),
    }).index("by_project_id", ["projectId"]),

    // Per-post AI feedback - used to build context for generation
    post_analysis: defineTable({
        projectId: v.id("projects"),
        analysisId: v.optional(v.id("brand_analysis")), // Optional - can analyze without brand analysis
        postId: v.id("instagram_posts"),
        currentCaption: v.optional(v.string()),

        // Analysis fields (from "Analisar" action) - used for context building
        hasAnalysis: v.optional(v.boolean()),
        score: v.optional(v.number()), // 0-100
        analysisDetails: v.optional(v.object({
            strengths: v.array(v.string()),
            weaknesses: v.array(v.string()),
            engagementPrediction: v.string(),
            hashtagAnalysis: v.string(),
            toneAnalysis: v.string(),
        })),
        reasoning: v.optional(v.string()),

        // Legacy fields (kept for backwards compatibility with existing data)
        suggestedCaption: v.optional(v.string()),
        improvements: v.optional(v.array(v.object({
            type: v.string(),
            issue: v.string(),
            suggestion: v.string(),
        }))),
        hasReimagination: v.optional(v.boolean()),

        createdAt: v.number(),
    }).index("by_analysis_id", ["analysisId"])
      .index("by_post_id", ["postId"])
      .index("by_project_id", ["projectId"]),

    // AI-generated posts
    generated_posts: defineTable({
        projectId: v.id("projects"),
        caption: v.string(),
        additionalContext: v.optional(v.string()), // User's additional input
        // Context references
        brandAnalysisId: v.id("brand_analysis"),
        sourcePostIds: v.array(v.id("instagram_posts")), // Posts used as context
        // AI reasoning
        reasoning: v.optional(v.string()),
        // Generation metadata
        model: v.optional(v.string()),
        // Status
        status: v.string(), // "generated" | "edited" | "regenerated"
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_project_id", ["projectId"])
      .index("by_created_at", ["createdAt"]),

    // Per-project conversation
    conversations: defineTable({
        projectId: v.id("projects"),
        userId: v.id("users"),
        createdAt: v.number(),
    }).index("by_project_id", ["projectId"])
      .index("by_user_id", ["userId"]),

    // Chat messages
    conversation_messages: defineTable({
        conversationId: v.id("conversations"),
        role: v.string(), // "user" | "assistant"
        content: v.string(),
        createdAt: v.number(),
    }).index("by_conversation_id", ["conversationId"]),

    content_calendar: defineTable({
        projectId: v.id("projects"),
        date: v.string(), // ISO date
        status: v.string(), // PLANNED, DRAFTED, APPROVED, POSTED
        caption: v.string(),
        mediaUrl: v.optional(v.string()),
        prompt: v.optional(v.string()),
        createdAt: v.number(),
    }).index("by_project_id", ["projectId"]),

    assets: defineTable({
        projectId: v.id("projects"),
        type: v.string(), // IMAGE, COLOR_PALETTE, BRAND_KIT
        url: v.string(),
        metadata: v.optional(v.any()),
        createdAt: v.number(),
    }).index("by_project_id", ["projectId"]),
});
