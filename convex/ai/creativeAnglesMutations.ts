import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const save = mutation({
    args: {
        projectId: v.id("projects"),
        briefHash: v.string(),
        angles: v.array(v.object({
            id: v.string(),
            hook: v.string(),
            approach: v.string(),
            whyItWorks: v.string(),
            exampleOpener: v.string(),
        })),
        brief: v.object({
            postType: v.string(),
            contentPillar: v.optional(v.string()),
            customTopic: v.optional(v.string()),
            toneOverride: v.optional(v.array(v.string())),
            referenceText: v.optional(v.string()),
            additionalContext: v.optional(v.string()),
        }),
        expiresAt: v.number(),
    },
    handler: async (ctx, args) => {
        // Delete any existing with same hash
        const existing = await ctx.db
            .query("creative_angles")
            .withIndex("by_brief_hash", (q) => q.eq("briefHash", args.briefHash))
            .first();

        if (existing) {
            await ctx.db.delete(existing._id);
        }

        return await ctx.db.insert("creative_angles", {
            projectId: args.projectId,
            briefHash: args.briefHash,
            angles: args.angles,
            brief: args.brief,
            createdAt: Date.now(),
            expiresAt: args.expiresAt,
        });
    },
});

export const getByHash = query({
    args: {
        projectId: v.id("projects"),
        briefHash: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("creative_angles")
            .withIndex("by_brief_hash", (q) => q.eq("briefHash", args.briefHash))
            .filter((q) => q.eq(q.field("projectId"), args.projectId))
            .first();
    },
});

export const getLatest = query({
    args: {
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("creative_angles")
            .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
            .order("desc")
            .first();
    },
});
