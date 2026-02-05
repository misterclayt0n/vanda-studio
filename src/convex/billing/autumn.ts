import { v } from "convex/values";
import { action, query } from "../_generated/server";
import { autumn } from "../autumn";

const BASE_URL = process.env.PUBLIC_APP_URL || "http://localhost:5173";

const PLAN_IDS = ["basico", "mediano", "profissional"] as const;
type PlanId = (typeof PLAN_IDS)[number];

const PlanIdSchema = v.union(
    v.literal("basico"),
    v.literal("mediano"),
    v.literal("profissional")
);

export const startCheckout = action({
    args: {
        planId: PlanIdSchema,
    },
    handler: async (ctx, args): Promise<{ checkoutUrl: string | null }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const successUrl = `${BASE_URL}/billing/success`;
        const cancelUrl = `${BASE_URL}/billing?expired=true`;

        const result = await autumn.checkout(ctx, {
            productId: args.planId as PlanId,
            successUrl,
            checkoutSessionParams: {
                cancel_url: cancelUrl,
            },
        });

        if (result.error) {
            throw new Error(result.error.message || "Autumn checkout failed");
        }

        return {
            checkoutUrl: result.data?.url ?? null,
        };
    },
});

export const attachPlan = action({
    args: {
        planId: PlanIdSchema,
    },
    handler: async (ctx, args): Promise<{ checkoutUrl: string | null }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const successUrl = `${BASE_URL}/billing/success`;
        const cancelUrl = `${BASE_URL}/billing?expired=true`;

        const result = await autumn.attach(ctx, {
            productId: args.planId as PlanId,
            successUrl,
            checkoutSessionParams: {
                cancel_url: cancelUrl,
            },
        });

        if (result.error) {
            throw new Error(result.error.message || "Autumn attach failed");
        }

        return {
            checkoutUrl: result.data?.checkout_url ?? null,
        };
    },
});

export const getBillingPortalUrl = action({
    args: {},
    handler: async (ctx): Promise<{ url: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const returnUrl = `${BASE_URL}/billing`;
        const result = await autumn.customers.billingPortal(ctx, { returnUrl });

        if (result.error) {
            throw new Error(result.error.message || "Failed to open billing portal");
        }

        return { url: result.data?.url ?? "" };
    },
});

export const getAutumnCustomer = action({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const result = await autumn.customers.get(ctx);

        if (result.error) {
            throw new Error(result.error.message || "Failed to load customer");
        }

        return result.data;
    },
});

export const refreshCustomer = action({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const result = await autumn.customers.get(ctx);

        if (result.error) {
            throw new Error(result.error.message || "Failed to refresh customer");
        }

        return { success: true };
    },
});
