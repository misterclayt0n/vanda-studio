import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

const DEMO_LIMIT_ANONYMOUS = 1; // Anonymous users get 1 demo

// Check demo usage for a fingerprint
export const checkDemoUsage = query({
    args: {
        fingerprint: v.string(),
    },
    handler: async (ctx, args) => {
        const usage = await ctx.db
            .query("demo_usage")
            .withIndex("by_fingerprint", (q) => q.eq("fingerprint", args.fingerprint))
            .collect();

        return {
            used: usage.length,
            limit: DEMO_LIMIT_ANONYMOUS,
            canUse: usage.length < DEMO_LIMIT_ANONYMOUS,
        };
    },
});

// Record demo usage
export const recordDemoUsage = mutation({
    args: {
        fingerprint: v.string(),
        instagramHandle: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("demo_usage", {
            fingerprint: args.fingerprint,
            instagramHandle: args.instagramHandle,
            usedAt: Date.now(),
        });
    },
});
