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

    // AI-generated posts
    generated_posts: defineTable({
        projectId: v.optional(v.id("projects")), // Optional - can be null for standalone posts
        userId: v.optional(v.id("users")), // Direct user ownership for standalone posts
        caption: v.string(),
        // Legacy fields - kept for backwards compatibility with existing data
        additionalContext: v.optional(v.string()),
        brandAnalysisId: v.optional(v.string()), // Legacy - no longer used
        selectedAngle: v.optional(v.any()), // Legacy - no longer used
        // Source posts used as context (optional)
        sourcePostIds: v.optional(v.array(v.id("instagram_posts"))),
        // AI reasoning
        reasoning: v.optional(v.string()),
        // Generated image
        imageStorageId: v.optional(v.id("_storage")),
        imagePrompt: v.optional(v.string()), // The prompt used to generate the image
        // Generation metadata
        model: v.optional(v.string()),
        imageModel: v.optional(v.string()),
        // Status
        status: v.string(), // "generating_caption" | "generating_images" | "generated" | "edited" | "regenerated"
        createdAt: v.number(),
        updatedAt: v.number(),
        // Progressive loading fields
        pendingImageModels: v.optional(v.array(v.string())), // Models still generating
        totalImageModels: v.optional(v.number()), // Total models requested
        // Soft delete
        deletedAt: v.optional(v.number()), // Timestamp when soft-deleted (null = not deleted)

        // Lineage tracking - for posts created from edit conversations
        parentPostId: v.optional(v.id("generated_posts")), // The post this was derived from
        sourceConversationId: v.optional(v.id("image_edit_conversations")), // The conversation that created this
        sourceOutputId: v.optional(v.id("image_edit_outputs")), // The specific output

        // Full brief that was used for generation
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
    }).index("by_project_id", ["projectId"])
      .index("by_created_at", ["createdAt"])
      .index("by_user_id", ["userId"])
      .index("by_user_created", ["userId", "createdAt"])
      .index("by_source_output", ["sourceOutputId"])
      .index("by_parent_post", ["parentPostId"]),

    // Reference images uploaded by user for generation
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

    // Generation history - tracks all versions/iterations of a generated post
    // DEPRECATED: Use chat_messages instead for new posts
    generation_history: defineTable({
        generatedPostId: v.id("generated_posts"),
        version: v.number(), // 1, 2, 3, etc.
        // What was generated in this version
        caption: v.string(),
        imageStorageId: v.optional(v.id("_storage")),
        imagePrompt: v.optional(v.string()),
        // What triggered this version
        action: v.string(), // "initial" | "regenerate_image" | "regenerate_caption" | "edit_caption" | "regenerate_both"
        // User feedback that triggered regeneration (if any)
        feedback: v.optional(v.string()), // e.g., "Make the image brighter", "Less formal tone"
        // Metadata
        model: v.optional(v.string()),
        imageModel: v.optional(v.string()),
        createdAt: v.number(),
    }).index("by_generated_post_id", ["generatedPostId"])
      .index("by_version", ["generatedPostId", "version"]),

    // Chat messages for post generation conversations
    chat_messages: defineTable({
        generatedPostId: v.id("generated_posts"),
        role: v.string(), // "user" | "assistant" | "system"
        content: v.string(), // The message text

        // What action was taken (user messages only)
        action: v.optional(v.string()), // "initial" | "regenerate_caption" | "regenerate_image" | "regenerate_both"

        // State snapshot AFTER this message (assistant messages only)
        snapshot: v.optional(v.object({
            caption: v.string(),
            imageStorageId: v.optional(v.id("_storage")),
            imagePrompt: v.optional(v.string()),
        })),

        // Attachments for this message (user messages only)
        attachments: v.optional(v.object({
            // Reference images - URLs for external, storageIds for uploaded
            imageUrls: v.optional(v.array(v.string())),
            imageStorageIds: v.optional(v.array(v.id("_storage"))),
            // Instagram post reference
            instagramPostUrl: v.optional(v.string()),
            instagramPostCaption: v.optional(v.string()),
            // Text context
            referenceText: v.optional(v.string()),
        })),

        // Generation metadata (assistant messages only)
        model: v.optional(v.string()),
        imageModel: v.optional(v.string()),
        creditsUsed: v.optional(v.number()),

        createdAt: v.number(),
    }).index("by_generated_post_id", ["generatedPostId"])
      .index("by_created_at", ["generatedPostId", "createdAt"]),

    // Generated images - stores multiple images per post (one per model)
    generated_images: defineTable({
        generatedPostId: v.id("generated_posts"),
        storageId: v.id("_storage"),
        model: v.string(), // The model used to generate this image
        aspectRatio: v.string(), // "1:1", "16:9", etc.
        resolution: v.string(), // "standard", "high", "ultra"
        prompt: v.string(), // The prompt used to generate the image
        width: v.number(),
        height: v.number(),
        createdAt: v.number(),
    }).index("by_generated_post_id", ["generatedPostId"]),

    // ============================================================================
    // Image Editing Conversations
    // ============================================================================

    // Conversations for iteratively editing images
    image_edit_conversations: defineTable({
        // Owner
        userId: v.id("users"),

        // Source image that started this conversation
        sourceImageId: v.id("generated_images"),
        sourceStorageId: v.id("_storage"), // Denormalized for quick access

        // Metadata
        title: v.string(), // Auto-generated from first prompt

        // Settings (defaults for new turns, inherited from source)
        aspectRatio: v.string(), // "1:1", "16:9", etc.
        resolution: v.string(), // "standard", "high", "ultra"

        // Timestamps
        createdAt: v.number(),
        updatedAt: v.number(),
        // Soft delete
        deletedAt: v.optional(v.number()), // Timestamp when soft-deleted (null = not deleted)
    }).index("by_user_id", ["userId"])
      .index("by_source_image", ["sourceImageId"])
      .index("by_user_created", ["userId", "createdAt"]),

    // Each turn in an image editing conversation
    image_edit_turns: defineTable({
        conversationId: v.id("image_edit_conversations"),
        turnIndex: v.number(), // 0, 1, 2, ...

        // User input
        userMessage: v.string(),
        selectedModels: v.array(v.string()), // Models chosen for this turn

        // Additional reference images (user-uploaded, not auto from previous turn)
        manualReferenceIds: v.optional(v.array(v.id("_storage"))),

        // Generation state (for progressive loading)
        status: v.string(), // "pending" | "generating" | "completed" | "error"
        pendingModels: v.optional(v.array(v.string())), // Models still generating

        createdAt: v.number(),
    }).index("by_conversation", ["conversationId"])
      .index("by_conversation_turn", ["conversationId", "turnIndex"]),

    // Output images for each turn (one per model)
    image_edit_outputs: defineTable({
        turnId: v.id("image_edit_turns"),
        conversationId: v.id("image_edit_conversations"), // Denormalized for queries

        // Image data
        storageId: v.id("_storage"),
        model: v.string(),
        prompt: v.string(), // The prompt used
        width: v.number(),
        height: v.number(),

        createdAt: v.number(),
    }).index("by_turn", ["turnId"])
      .index("by_conversation", ["conversationId"]),
});
