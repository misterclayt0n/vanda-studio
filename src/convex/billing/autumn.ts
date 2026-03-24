import { v } from "convex/values";
import { action, query } from "../_generated/server";
import { autumn } from "../autumn";
import { getBillingUsageOverview } from "./autumnUsage";

const BASE_URL = process.env.PUBLIC_APP_URL || "http://localhost:5173";

const PLAN_IDS = ["basico", "mediano", "profissional"] as const;
type PlanId = (typeof PLAN_IDS)[number];

const PlanIdSchema = v.union(
    v.literal("basico"),
    v.literal("mediano"),
    v.literal("profissional")
);

function summarizeCustomer(customerData: any) {
    const activeProduct = customerData?.products?.find(
        (product: any) =>
            product.status === "active" || product.status === "trialing"
    );
    const scheduled = customerData?.products?.find(
        (product: any) => product.status === "scheduled"
    );
    const usage = getBillingUsageOverview(customerData);

    return {
        activePlanId: activeProduct?.id ?? null,
        scheduledPlan: scheduled
            ? {
                  id: scheduled.id,
                  startsAt:
                      scheduled.current_period_start ??
                      scheduled.started_at ??
                      null,
              }
            : null,
        accessStatus:
            activeProduct?.status === "trialing"
                ? "trialing"
                : activeProduct
                  ? "active"
                  : "trial_eligible",
        trialEligible: !activeProduct,
        renewalAt:
            activeProduct?.current_period_end ??
            activeProduct?.trial_ends_at ??
            null,
        usage,
    };
}

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
        const cancelUrl = `${BASE_URL}/account?expired=true#planos`;

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
        const cancelUrl = `${BASE_URL}/account?expired=true#planos`;

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

        const returnUrl = `${BASE_URL}/account#planos`;
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

export const getBillingOverview = action({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        try {
            const result = await autumn.customers.get(ctx);

            if (result.error) {
                throw new Error(result.error.message || "Failed to load customer");
            }

            return summarizeCustomer(result.data);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            // Autumn HTTP layer sometimes returns an HTML error page (wrong key, outage, proxy) → JSON.parse fails
            if (
                msg.includes("Unexpected token") ||
                msg.includes("not valid JSON") ||
                msg.includes("<html")
            ) {
                console.error(
                    "[getBillingOverview] Non-JSON response from billing API — check AUTUMN_SECRET_KEY and Autumn status:",
                    msg.slice(0, 240)
                );
                return null;
            }
            throw err;
        }
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
