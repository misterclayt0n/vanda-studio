import { v } from "convex/values";

export const launchPostsGenerationStatusValidator = v.union(
    v.literal("generating"),
    v.literal("completed"),
    v.literal("partial"),
    v.literal("error")
);

export const launchPostsGenerationPhaseValidator = v.union(
	v.literal("ideas"),
	v.literal("image"),
	v.literal("post"),
	v.literal("schedule")
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
	/** Granular UI progress (optional for older documents). */
	phase: v.optional(launchPostsGenerationPhaseValidator),
	/** 1-based index of the post currently being worked on while generating. */
	activePostNumber: v.optional(v.number()),
	currentImagePrompt: v.optional(v.string()),
	currentCaption: v.optional(v.string()),
	/** Unix ms for the slot being scheduled (schedule phase). */
	scheduledFor: v.optional(v.number()),
});
