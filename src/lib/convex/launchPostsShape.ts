import { v } from "convex/values";

export const launchPostsGenerationStatusValidator = v.union(
    v.literal("generating"),
    v.literal("completed"),
    v.literal("partial"),
    v.literal("error")
);

export const launchPostsGenerationValidator = v.object({
    status: launchPostsGenerationStatusValidator,
    totalPosts: v.number(),
    completedPosts: v.number(),
    generatedPostIds: v.array(v.id("generated_posts")),
    startedAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
});
