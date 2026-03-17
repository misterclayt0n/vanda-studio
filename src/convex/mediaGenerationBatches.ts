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
        requestedModels: v.array(v.string()),
        prompt: v.string(),
        aspectRatio: v.string(),
        resolution: v.string(),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("media_generation_batches", {
            userId: args.userId,
            ...(args.projectId && { projectId: args.projectId }),
            status: "generating",
            pendingModels: args.pendingModels,
            lastProgressAt: now,
            requestedModels: args.requestedModels,
            totalModels: args.totalModels,
            prompt: args.prompt,
            aspectRatio: args.aspectRatio,
            resolution: args.resolution,
            createdAt: now,
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
            lastProgressAt: Date.now(),
        });
    },
});

export const markError = internalMutation({
    args: {
        id: v.id("media_generation_batches"),
        clearPending: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            status: "error",
            lastProgressAt: Date.now(),
            ...(args.clearPending ? { pendingModels: [] } : {}),
        });
    },
});

export const cleanupStaleByUser = mutation({
    args: {
        staleAfterMs: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return 0;
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return 0;
        }

        const staleAfterMs = args.staleAfterMs ?? 5 * 60 * 1000;
        const cutoff = Date.now() - staleAfterMs;
        const batches = await ctx.db
            .query("media_generation_batches")
            .withIndex("by_user_created", (q) => q.eq("userId", user._id))
            .order("desc")
            .collect();

        let cleaned = 0;

        for (const batch of batches) {
            const lastProgressAt = batch.lastProgressAt ?? batch.createdAt;
            if (
                batch.status === "generating" &&
                (batch.pendingModels?.length ?? 0) > 0 &&
                lastProgressAt < cutoff
            ) {
                await ctx.db.patch(batch._id, {
                    status: "error",
                    pendingModels: [],
                    lastProgressAt: Date.now(),
                });
                cleaned += 1;
            }
        }

        return cleaned;
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
