import { v } from "convex/values";
import { mutation, query, internalMutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// Plan configurations
export const PLANS = {
    free: {
        promptsLimit: 10,
        name: "Free",
    },
    pro: {
        promptsLimit: 100,
        name: "Pro",
    },
} as const;

export type PlanType = keyof typeof PLANS;

// Get the start and end of the current billing period (monthly)
function getBillingPeriod(): { start: number; end: number } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    return { start, end };
}

// Check if user has remaining quota
export const checkQuota = query({
    args: {},
    handler: async (ctx): Promise<{
        hasQuota: boolean;
        remaining: number;
        limit: number;
        used: number;
        plan: string;
        periodEnd: number;
    } | null> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return null;
        }

        let subscription = await ctx.db
            .query("user_subscriptions")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .unique();

        // If no subscription exists, user needs to create one (handled by ensureSubscription)
        if (!subscription) {
            const plan = PLANS.free;
            const period = getBillingPeriod();
            return {
                hasQuota: true,
                remaining: plan.promptsLimit,
                limit: plan.promptsLimit,
                used: 0,
                plan: "free",
                periodEnd: period.end,
            };
        }

        // Check if we need to reset the period
        const now = Date.now();
        if (now >= subscription.periodEnd) {
            // Period has ended, but we'll reset on next mutation
            // For the query, show as if reset
            const period = getBillingPeriod();
            return {
                hasQuota: true,
                remaining: subscription.promptsLimit,
                limit: subscription.promptsLimit,
                used: 0,
                plan: subscription.plan,
                periodEnd: period.end,
            };
        }

        const remaining = subscription.promptsLimit - subscription.promptsUsed;

        return {
            hasQuota: remaining > 0,
            remaining: Math.max(0, remaining),
            limit: subscription.promptsLimit,
            used: subscription.promptsUsed,
            plan: subscription.plan,
            periodEnd: subscription.periodEnd,
        };
    },
});

// Ensure user has a subscription (create free tier if not exists)
export const ensureSubscription = mutation({
    args: {},
    handler: async (ctx): Promise<Id<"user_subscriptions">> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

        // Check if subscription already exists
        const existing = await ctx.db
            .query("user_subscriptions")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .unique();

        if (existing) {
            // Check if period needs reset
            const now = Date.now();
            if (now >= existing.periodEnd) {
                const period = getBillingPeriod();
                await ctx.db.patch(existing._id, {
                    promptsUsed: 0,
                    periodStart: period.start,
                    periodEnd: period.end,
                });
            }
            return existing._id;
        }

        // Create new free tier subscription
        const period = getBillingPeriod();
        const subscriptionId = await ctx.db.insert("user_subscriptions", {
            userId: user._id,
            plan: "free",
            promptsLimit: PLANS.free.promptsLimit,
            promptsUsed: 0,
            periodStart: period.start,
            periodEnd: period.end,
            createdAt: Date.now(),
        });

        return subscriptionId;
    },
});

// Consume a prompt (decrement quota)
export const consumePrompt = mutation({
    args: {
        count: v.optional(v.number()), // defaults to 1
    },
    handler: async (ctx, args): Promise<{ success: boolean; remaining: number }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

        let subscription = await ctx.db
            .query("user_subscriptions")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .unique();

        if (!subscription) {
            throw new Error("No subscription found. Call ensureSubscription first.");
        }

        // Check if period needs reset
        const now = Date.now();
        if (now >= subscription.periodEnd) {
            const period = getBillingPeriod();
            await ctx.db.patch(subscription._id, {
                promptsUsed: 0,
                periodStart: period.start,
                periodEnd: period.end,
            });
            // Refresh subscription data
            subscription = (await ctx.db.get(subscription._id))!;
        }

        const count = args.count ?? 1;
        const remaining = subscription.promptsLimit - subscription.promptsUsed;

        if (remaining < count) {
            throw new Error(`Insufficient quota. You have ${remaining} prompts remaining.`);
        }

        await ctx.db.patch(subscription._id, {
            promptsUsed: subscription.promptsUsed + count,
        });

        return {
            success: true,
            remaining: remaining - count,
        };
    },
});

// Get usage history/stats for the user
export const getUsageStats = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return null;
        }

        const subscription = await ctx.db
            .query("user_subscriptions")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .unique();

        if (!subscription) {
            return {
                plan: "free",
                planName: PLANS.free.name,
                promptsUsed: 0,
                promptsLimit: PLANS.free.promptsLimit,
                percentUsed: 0,
                daysUntilReset: 30,
            };
        }

        const now = Date.now();
        const daysUntilReset = Math.ceil((subscription.periodEnd - now) / (1000 * 60 * 60 * 24));
        const percentUsed = Math.round((subscription.promptsUsed / subscription.promptsLimit) * 100);

        return {
            plan: subscription.plan,
            planName: PLANS[subscription.plan as PlanType]?.name ?? subscription.plan,
            promptsUsed: subscription.promptsUsed,
            promptsLimit: subscription.promptsLimit,
            percentUsed,
            daysUntilReset: Math.max(0, daysUntilReset),
        };
    },
});

// Admin: Upgrade user plan (for future use)
export const upgradePlan = mutation({
    args: {
        plan: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

        const planConfig = PLANS[args.plan as PlanType];
        if (!planConfig) {
            throw new Error(`Invalid plan: ${args.plan}`);
        }

        const subscription = await ctx.db
            .query("user_subscriptions")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .unique();

        if (!subscription) {
            throw new Error("No subscription found");
        }

        await ctx.db.patch(subscription._id, {
            plan: args.plan,
            promptsLimit: planConfig.promptsLimit,
        });

        return { success: true, plan: args.plan };
    },
});
