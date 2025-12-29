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
        // Embedding for semantic search (1536 dimensions for text-embedding-3-small)
        captionEmbedding: v.optional(v.array(v.float64())),
        // Engagement score (normalized 0-1) for weighting
        engagementScore: v.optional(v.float64()),
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
        // NEW: Visual Identity extracted from actual images using vision LLM
        visualIdentity: v.optional(v.object({
            colorPalette: v.array(v.string()),        // Hex codes
            layoutPatterns: v.array(v.string()),     // "centered", "grid", "split"
            photographyStyle: v.string(),            // "product-focused", "lifestyle"
            graphicElements: v.array(v.string()),    // "logo overlay", "borders", "icons"
            filterTreatment: v.string(),             // "warm", "cool", "high-contrast"
            dominantColors: v.optional(v.array(v.string())), // Most used colors
            consistencyScore: v.optional(v.number()), // How consistent is visual style
        })),
        // NEW: Business category confirmed/extracted
        businessCategory: v.optional(v.string()),
        productOrService: v.optional(v.string()),
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
        // Legacy field - kept for backwards compatibility
        additionalContext: v.optional(v.string()),
        // Context references
        brandAnalysisId: v.id("brand_analysis"),
        sourcePostIds: v.array(v.id("instagram_posts")), // Posts used as context
        // AI reasoning
        reasoning: v.optional(v.string()),
        // Generated image
        imageStorageId: v.optional(v.id("_storage")),
        imagePrompt: v.optional(v.string()), // The prompt used to generate the image
        // Generation metadata
        model: v.optional(v.string()),
        imageModel: v.optional(v.string()),
        // Status
        status: v.string(), // "generated" | "edited" | "regenerated"
        createdAt: v.number(),
        updatedAt: v.number(),

        // NEW: Full brief that was used for generation
        brief: v.optional(v.object({
            postType: v.string(), // "promocao" | "conteudo_profissional" | "engajamento"
            contentPillar: v.optional(v.string()), // Selected pillar name
            customTopic: v.optional(v.string()),
            toneOverride: v.optional(v.array(v.string())),
            captionLength: v.optional(v.string()), // "curta" | "media" | "longa"
            includeHashtags: v.optional(v.boolean()),
            additionalContext: v.optional(v.string()),
            // Reference materials info (not the actual files)
            referenceText: v.optional(v.string()),
            referenceImageIds: v.optional(v.array(v.id("_storage"))),
        })),
        // NEW: Selected creative angle
        selectedAngle: v.optional(v.object({
            hook: v.string(),
            approach: v.string(),
            whyItWorks: v.string(),
        })),
    }).index("by_project_id", ["projectId"])
      .index("by_created_at", ["createdAt"]),

    // NEW: Creative angles (brainstormed options before generation)
    creative_angles: defineTable({
        projectId: v.id("projects"),
        briefHash: v.string(), // Hash of the brief to retrieve later
        angles: v.array(v.object({
            id: v.string(),
            hook: v.string(),
            approach: v.string(),
            whyItWorks: v.string(),
            exampleOpener: v.string(),
        })),
        // The brief that generated these angles
        brief: v.object({
            postType: v.string(),
            contentPillar: v.optional(v.string()),
            customTopic: v.optional(v.string()),
            toneOverride: v.optional(v.array(v.string())),
            referenceText: v.optional(v.string()),
            additionalContext: v.optional(v.string()),
        }),
        createdAt: v.number(),
        expiresAt: v.number(), // TTL - angles expire after some time
    }).index("by_project_id", ["projectId"])
      .index("by_brief_hash", ["briefHash"]),

    // NEW: Reference images uploaded by user for generation
    reference_images: defineTable({
        projectId: v.id("projects"),
        storageId: v.id("_storage"),
        filename: v.string(),
        mimeType: v.string(),
        // Vision LLM analysis of the image
        analysis: v.optional(v.object({
            description: v.string(),
            dominantColors: v.array(v.string()),
            style: v.string(),
            mood: v.string(),
            elements: v.array(v.string()), // Objects/elements detected
        })),
        createdAt: v.number(),
    }).index("by_project_id", ["projectId"]),

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

    // Demo usage tracking for rate limiting anonymous users
    demo_usage: defineTable({
        fingerprint: v.string(), // Browser fingerprint or device ID
        usedAt: v.number(),
        instagramHandle: v.string(),
    }).index("by_fingerprint", ["fingerprint"]),
});
