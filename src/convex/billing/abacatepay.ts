import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { internal, api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { PLANS } from "./usage";

// ============================================================================
// Configuration
// ============================================================================

const ABACATEPAY_BASE_URL = "https://api.abacatepay.com";

// Plan types that can be purchased (excludes free)
export type PurchasablePlan = "sub1" | "sub2" | "sub3";

// Plan display info
export const PLAN_INFO: Record<PurchasablePlan, { name: string; description: string }> = {
    sub1: { name: "Vanda Studio Basico", description: "75 imagens por mes" },
    sub2: { name: "Vanda Studio Profissional", description: "150 imagens por mes" },
    sub3: { name: "Vanda Studio Ilimitado", description: "300 imagens por mes" },
};

// ============================================================================
// API Helpers
// ============================================================================

interface AbacatePayResponse<T> {
    data: T;
    error: string | null;
}

interface AbacateCustomerData {
    id: string;
    metadata: {
        name: string;
        cellphone: string;
        email: string;
        taxId: string;
    };
}

interface AbacateBillingData {
    id: string;
    url: string;
    amount: number;
    status: string;
    devMode: boolean;
    methods: string[];
    products: Array<{
        id: string;
        externalId: string;
        quantity: number;
    }>;
    frequency: string;
    nextBilling: string | null;
    customer: AbacateCustomerData;
    createdAt: string;
    updatedAt: string;
}

async function abacateRequest<T>(
    endpoint: string,
    method: "GET" | "POST",
    body?: Record<string, unknown>
): Promise<T> {
    const token = process.env.ABACATEPAY_API_TOKEN;
    if (!token) {
        throw new Error("ABACATEPAY_API_TOKEN nao configurado");
    }

    const url = endpoint.startsWith("http")
        ? endpoint
        : `${ABACATEPAY_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
        method,
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        ...(body && { body: JSON.stringify(body) }),
    });

    const json = await response.json() as AbacatePayResponse<T>;

    if (!response.ok || json.error) {
        throw new Error(`AbacatePay API error: ${json.error || response.statusText}`);
    }

    return json.data;
}

// ============================================================================
// Customer Management
// ============================================================================

// Internal helper for customer creation (used by multiple actions)
async function createCustomerInternal(
    ctx: ActionCtx,
    clerkId: string
): Promise<{ customerId: Id<"abacatepay_customers">; abacateCustomerId: string }> {
    // Get user data
    const user = await ctx.runQuery(internal.billing.abacatepay.getUserByClerkId, {
        clerkId,
    });

    if (!user) {
        throw new Error("Usuario nao encontrado");
    }

    // Check if customer already exists
    const existingCustomer = await ctx.runQuery(
        internal.billing.abacatepay.getCustomerByUserId,
        { userId: user._id }
    );

    if (existingCustomer) {
        return {
            customerId: existingCustomer._id,
            abacateCustomerId: existingCustomer.abacateCustomerId,
        };
    }

    // Create customer in AbacatePay
    const response = await abacateRequest<AbacateCustomerData>(
        "/v1/customer/create",
        "POST",
        {
            name: user.name || "Usuario",
            cellphone: "",
            email: user.email,
            taxId: "",
        }
    );

    // Store customer in database
    const customerId = await ctx.runMutation(
        internal.billing.abacatepay.storeCustomer,
        {
            userId: user._id,
            abacateCustomerId: response.id,
            email: user.email,
            name: user.name || "Usuario",
        }
    );

    return { customerId, abacateCustomerId: response.id };
}

export const createCustomer = action({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Voce precisa estar autenticado");
        }
        return createCustomerInternal(ctx, identity.subject);
    },
});

// ============================================================================
// Billing/Checkout
// ============================================================================

export const createCheckoutSession = action({
    args: {
        plan: v.union(v.literal("sub1"), v.literal("sub2"), v.literal("sub3")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Voce precisa estar autenticado");
        }

        const planConfig = PLANS[args.plan];
        const planInfo = PLAN_INFO[args.plan];

        // Get or create customer
        const customer = await createCustomerInternal(ctx, identity.subject);

        // Get app URL for redirect URLs
        const baseUrl = process.env.PUBLIC_APP_URL || "http://localhost:5173";
        const completionUrl = `${baseUrl}/billing/success?plan=${args.plan}`;
        const returnUrl = `${baseUrl}/billing?expired=true`;

        // Create billing in AbacatePay
        const response = await abacateRequest<AbacateBillingData>(
            "/v1/billing/create",
            "POST",
            {
                frequency: "MULTIPLE_PAYMENTS",
                methods: ["PIX", "CARD"],
                products: [
                    {
                        externalId: args.plan,
                        name: planInfo.name,
                        description: planInfo.description,
                        quantity: 1,
                        price: planConfig.price,
                    },
                ],
                returnUrl,
                completionUrl,
                customerId: customer.abacateCustomerId,
            }
        );

        // Get user for storing billing
        const user = await ctx.runQuery(internal.billing.abacatepay.getUserByClerkId, {
            clerkId: identity.subject,
        });

        if (!user) {
            throw new Error("Usuario nao encontrado");
        }

        // Store billing record with plan info
        await ctx.runMutation(internal.billing.abacatepay.storeBilling, {
            userId: user._id,
            customerId: customer.customerId,
            abacateBillingId: response.id,
            status: response.status,
            frequency: "MULTIPLE_PAYMENTS",
            methods: ["PIX", "CARD"],
            amount: planConfig.price,
            checkoutUrl: response.url,
            plan: args.plan,
        });

        return { checkoutUrl: response.url, billingId: response.id };
    },
});

// Check billing status (for polling or manual refresh)
export const checkBillingStatus = action({
    args: {
        billingId: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Voce precisa estar autenticado");
        }

        const response = await abacateRequest<AbacateBillingData>(
            `/v1/billing/get?id=${args.billingId}`,
            "GET"
        );

        // Update local billing record
        await ctx.runMutation(internal.billing.abacatepay.updateBillingStatus, {
            abacateBillingId: args.billingId,
            status: response.status,
            paidAt: response.status === "PAID" ? Date.now() : undefined,
            nextBillingDate: response.nextBilling
                ? new Date(response.nextBilling).getTime()
                : undefined,
        });

        return {
            status: response.status,
            nextBilling: response.nextBilling,
        };
    },
});

// ============================================================================
// Internal Queries
// ============================================================================

export const getUserByClerkId = internalQuery({
    args: { clerkId: v.string() },
    handler: async (ctx, args) => {
        return ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
            .unique();
    },
});

export const getCustomerByUserId = internalQuery({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        return ctx.db
            .query("abacatepay_customers")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .first();
    },
});

export const getWebhookEvent = internalQuery({
    args: { eventId: v.string() },
    handler: async (ctx, args) => {
        return ctx.db
            .query("abacatepay_webhook_events")
            .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
            .first();
    },
});

export const getBillingByAbacateId = internalQuery({
    args: { abacateBillingId: v.string() },
    handler: async (ctx, args) => {
        return ctx.db
            .query("abacatepay_billings")
            .withIndex("by_abacate_billing_id", (q) =>
                q.eq("abacateBillingId", args.abacateBillingId)
            )
            .first();
    },
});

// ============================================================================
// Internal Mutations
// ============================================================================

export const storeCustomer = internalMutation({
    args: {
        userId: v.id("users"),
        abacateCustomerId: v.string(),
        email: v.string(),
        name: v.string(),
    },
    handler: async (ctx, args) => {
        return ctx.db.insert("abacatepay_customers", {
            ...args,
            createdAt: Date.now(),
        });
    },
});

export const storeBilling = internalMutation({
    args: {
        userId: v.id("users"),
        customerId: v.id("abacatepay_customers"),
        abacateBillingId: v.string(),
        status: v.string(),
        frequency: v.string(),
        methods: v.array(v.string()),
        amount: v.number(),
        checkoutUrl: v.string(),
        plan: v.string(),
    },
    handler: async (ctx, args) => {
        return ctx.db.insert("abacatepay_billings", {
            ...args,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

export const updateBillingStatus = internalMutation({
    args: {
        abacateBillingId: v.string(),
        status: v.string(),
        paidAt: v.optional(v.number()),
        nextBillingDate: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const billing = await ctx.db
            .query("abacatepay_billings")
            .withIndex("by_abacate_billing_id", (q) =>
                q.eq("abacateBillingId", args.abacateBillingId)
            )
            .first();

        if (billing) {
            await ctx.db.patch(billing._id, {
                status: args.status,
                updatedAt: Date.now(),
                ...(args.paidAt && { paidAt: args.paidAt }),
                ...(args.nextBillingDate && { nextBillingDate: args.nextBillingDate }),
            });
        }
    },
});

export const logWebhookEvent = internalMutation({
    args: {
        eventId: v.string(),
        eventType: v.string(),
        billingId: v.string(),
        payload: v.string(),
        success: v.boolean(),
        errorMessage: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return ctx.db.insert("abacatepay_webhook_events", {
            ...args,
            processedAt: Date.now(),
        });
    },
});

export const processPaymentConfirmed = internalMutation({
    args: {
        billingId: v.string(),
        eventId: v.string(),
        payload: v.string(),
    },
    handler: async (ctx, args) => {
        // Get billing record
        const billing = await ctx.db
            .query("abacatepay_billings")
            .withIndex("by_abacate_billing_id", (q) =>
                q.eq("abacateBillingId", args.billingId)
            )
            .first();

        if (!billing) {
            throw new Error(`Billing not found: ${args.billingId}`);
        }

        // Update billing status
        await ctx.db.patch(billing._id, {
            status: "PAID",
            paidAt: Date.now(),
            updatedAt: Date.now(),
        });

        // Get the plan config from the billing record
        const planKey = billing.plan as keyof typeof PLANS;
        const planConfig = PLANS[planKey];

        if (!planConfig) {
            throw new Error(`Invalid plan: ${billing.plan}`);
        }

        // Calculate subscription period (30 days from now)
        const now = Date.now();
        const periodEnd = now + (30 * 24 * 60 * 60 * 1000);

        // Activate subscription with the purchased plan
        const subscription = await ctx.db
            .query("user_subscriptions")
            .withIndex("by_user_id", (q) => q.eq("userId", billing.userId))
            .first();

        if (subscription) {
            await ctx.db.patch(subscription._id, {
                plan: billing.plan,
                promptsLimit: planConfig.promptsLimit,
                promptsUsed: 0, // Reset on upgrade/renewal
                periodStart: now,
                periodEnd: periodEnd,
                abacateBillingId: args.billingId,
                subscriptionSource: "abacatepay",
            });
        }

        return { success: true };
    },
});

// ============================================================================
// Public Queries
// ============================================================================

export const getSubscriptionWithPayment = query({
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
            .first();

        // Get latest billing if exists
        const latestBilling = await ctx.db
            .query("abacatepay_billings")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .order("desc")
            .first();

        return {
            subscription,
            billing: latestBilling,
            canUpgrade: subscription?.plan === "free" || !subscription,
        };
    },
});
