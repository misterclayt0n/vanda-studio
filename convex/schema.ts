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
        bio: v.optional(v.string()),
        followersCount: v.optional(v.number()),
        followingCount: v.optional(v.number()),
        postsCount: v.optional(v.number()),
        website: v.optional(v.string()),
        createdAt: v.number(),
    }).index("by_user_id", ["userId"]),

    instagram_posts: defineTable({
        projectId: v.id("projects"),
        instagramId: v.string(), // The IG post ID
        caption: v.optional(v.string()),
        mediaUrl: v.string(),
        mediaType: v.string(), // IMAGE, VIDEO, CAROUSEL_ALBUM
        permalink: v.string(),
        timestamp: v.string(), // ISO string from IG
        likeCount: v.optional(v.number()),
        commentsCount: v.optional(v.number()),
        // Analysis fields (can be filled later)
        analysis: v.optional(v.any()),
    }).index("by_project_id", ["projectId"]),

    brand_analysis: defineTable({
        projectId: v.id("projects"),
        strategy: v.string(), // JSON string or structured text
        brandVoice: v.string(),
        targetAudience: v.string(),
        contentPillars: v.array(v.string()),
        createdAt: v.number(),
    }).index("by_project_id", ["projectId"]),

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
