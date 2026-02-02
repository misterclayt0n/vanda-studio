import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// ============================================================================
// AbacatePay Webhook Handler
// ============================================================================

http.route({
    path: "/webhooks/abacatepay",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        try {
            const body = await request.json();

            // Extract event details
            const eventId = body.id || `evt_${Date.now()}`;
            const eventType = body.event || body.type || "unknown";

            // The billing ID might be in different places depending on the event format
            const billingId = body.data?.billing?.id ||
                body.billing?.id ||
                body.data?.id ||
                body.id ||
                "";

            if (!billingId) {
                console.error("Webhook received without billing ID:", body);
                return new Response(
                    JSON.stringify({ error: "Missing billing ID" }),
                    { status: 400, headers: { "Content-Type": "application/json" } }
                );
            }

            // Check for duplicate event (idempotency)
            const existingEvent = await ctx.runQuery(
                internal.billing.abacatepay.getWebhookEvent,
                { eventId }
            );

            if (existingEvent) {
                return new Response(
                    JSON.stringify({ received: true, duplicate: true }),
                    { status: 200, headers: { "Content-Type": "application/json" } }
                );
            }

            // Process based on event type
            if (eventType === "billing.paid" || eventType === "BILLING_PAID") {
                await ctx.runMutation(internal.billing.abacatepay.processPaymentConfirmed, {
                    billingId,
                    eventId,
                    payload: JSON.stringify(body),
                });
            }

            // Log successful processing
            await ctx.runMutation(internal.billing.abacatepay.logWebhookEvent, {
                eventId,
                eventType,
                billingId,
                payload: JSON.stringify(body),
                success: true,
            });

            return new Response(
                JSON.stringify({ received: true }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        } catch (error) {
            console.error("Webhook processing error:", error);

            // Try to log the error
            try {
                const body = await request.clone().json().catch(() => ({}));
                const eventId = (body as Record<string, unknown>).id as string || `evt_error_${Date.now()}`;
                const eventType = (body as Record<string, unknown>).event as string || "unknown";
                const billingId = "";

                await ctx.runMutation(internal.billing.abacatepay.logWebhookEvent, {
                    eventId,
                    eventType,
                    billingId,
                    payload: JSON.stringify(body),
                    success: false,
                    errorMessage: error instanceof Error ? error.message : "Unknown error",
                });
            } catch {
                // Ignore logging errors
            }

            return new Response(
                JSON.stringify({ error: "Webhook processing failed" }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }
    }),
});

export default http;
