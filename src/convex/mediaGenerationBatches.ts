import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// ============================================================================
// Internal Mutations (called by actions)
// ============================================================================

export const create = internalMutation({
    args: {
        userId: v.id("users"),
        projectId: v.optional(v.id("projects")),
        totalModels: v.number(),
        pendingModels: v.array(v.string()),
        prompt: v.string(),
        aspectRatio: v.string(),
        resolution: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("media_generation_batches", {
            userId: args.userId,
            ...(args.projectId && { projectId: args.projectId }),
            status: "generating",
            pendingModels: args.pendingModels,
            totalModels: args.totalModels,
            prompt: args.prompt,
            aspectRatio: args.aspectRatio,
            resolution: args.resolution,
            createdAt: Date.now(),
        });
    },
});

export const removeFromPending = internalMutation({
    args: {
        id: v.id("media_generation_batches"),
        model: v.string(),
    },
    handler: async (ctx, args) => {
        const batch = await ctx.db.get(args.id);
        if (!batch) return;

        const pending = batch.pendingModels?.filter((m) => m !== args.model) ?? [];
        const status = pending.length === 0 ? "completed" : "generating";

        await ctx.db.patch(args.id, {
            pendingModels: pending,
            status,
        });
    },
});

export const markError = internalMutation({
    args: {
        id: v.id("media_generation_batches"),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { status: "error" });
    },
});

// ============================================================================
// Queries
// ============================================================================

export const get = query({
    args: {
        id: v.id("media_generation_batches"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        return await ctx.db.get(args.id);
    },
});

export const listByUser = query({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return [];
        }

        const limit = args.limit ?? 10;

        return await ctx.db
            .query("media_generation_batches")
            .withIndex("by_user_created", (q) => q.eq("userId", user._id))
            .order("desc")
            .take(limit);
    },
});
