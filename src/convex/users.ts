import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { PLANS } from "./billing/usage";

// Get the start and end of the current billing period (monthly)
function getBillingPeriod(): { start: number; end: number } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    return { start, end };
}

export const store = mutation({
    args: {
        name: v.string(),
        email: v.string(),
        imageUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Called storeUser without authentication present");
        }

        // Check if we've already stored this identity before.
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (user !== null) {
            // If we've seen this identity before but the name has changed, patch the value.
            if (user.name !== args.name || user.email !== args.email || user.imageUrl !== args.imageUrl) {
                await ctx.db.patch(user._id, { name: args.name, email: args.email, imageUrl: args.imageUrl });
            }
            return user._id;
        }

        // If it's a new identity, create a new `User`.
        const userId = await ctx.db.insert("users", {
            name: args.name,
            email: args.email,
            clerkId: identity.subject,
            imageUrl: args.imageUrl,
        });

        // Auto-create free tier subscription for new users
        const period = getBillingPeriod();
        await ctx.db.insert("user_subscriptions", {
            userId,
            plan: "free",
            promptsLimit: PLANS.free.promptsLimit,
            promptsUsed: 0,
            periodStart: period.start,
            periodEnd: period.end,
            createdAt: Date.now(),
        });

        return userId;
    },
});

export const current = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }
        return await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();
    },
});
