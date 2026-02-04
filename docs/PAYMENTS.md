# Payments (Autumn + Stripe) Integration Plan

This plan replaces the previous gateway flow with Autumn as the billing layer on top of Stripe. Autumn will become the source of truth for plans, trials, usage limits, and subscription state. Stripe will remain the payment processor.

## Goals
- Three paid, recurring plans based on images generated per month.
- Basico: 75 images / month for R$87.
- Mediano: 150 images / month for R$149.
- Profissional: 300 images / month for R$249.
- Free 7‑day trial for Basico.
- Server-side enforcement of usage limits and access.

## Key Autumn Concepts To Use
- Plans define pricing plus feature limits.
- Metered, consumable features are used for monthly usage limits.
- `checkout` returns a Stripe Checkout URL or an upgrade preview (if a card is already on file).
- `attach` finalizes plan changes when no checkout URL is needed.
- `check` controls real-time access, with optional atomic “check + reserve” via `send_event`.
- `track` records usage events and decrements balances.
- Trials are configured in plan settings and will be card-required.

## High-Level Architecture
- Stripe handles payment collection and billing portal.
- Autumn sits between the app and Stripe, and stores subscription + usage state.
- Convex integrates with Autumn via the official `@useautumn/convex` component.
- The app queries Autumn for customer state and uses it for UI + gating.

## 1. Stripe + Autumn Setup
1. Create an Autumn account and connect the Stripe account.
2. Ensure Stripe Billing Portal is enabled (needed for “manage billing” links).
3. Set Stripe’s default currency to BRL in Autumn’s Stripe settings.
   - In sandbox, Autumn’s default Stripe account uses USD until you change it.
   - New Stripe prices in the chosen currency are created when `checkout` is called.
4. Create an Autumn secret key for server/Convex usage.

## 2. Configure Plans and Features in Autumn
Create one feature and three paid recurring plans.

Feature
- `images_generated`
- Type: metered + consumable
- Interval: month

Plans
- `basico`
  - Type: Paid, Recurring
  - Price: 87 BRL / month
  - Includes: 75 `images_generated` per month
  - Trial: 7 days, card required
- `mediano`
  - Type: Paid, Recurring
  - Price: 149 BRL / month
  - Includes: 150 `images_generated` per month
- `profissional`
  - Type: Paid, Recurring
  - Price: 249 BRL / month
  - Includes: 300 `images_generated` per month

Notes
- If we ever need add-ons (e.g., top-ups), add separate one-off plans.
- Use plan IDs exactly as above to keep code stable and explicit.

## 3. Trial Strategy (Card Required)
Autumn supports trials at the plan level. We will require a payment method to start the Basico trial.

Rationale
- Reduces abuse and aligns with long‑term subscription expectations.
- Enables automatic conversion to paid at trial end.

Implementation notes
- Always start trials via `checkout`, not `attach`, so Stripe collects a card.
- Trial auto-expires after 7 days and converts to paid unless canceled.
- Keep `fingerprint` for additional protection, but it is not relied on for gating.

## 4. Convex Integration
Autumn provides a first‑party Convex component.

Dependencies
- Convex >= 1.25.0
- `autumn-js` >= 0.1.24
- `@useautumn/convex`

Configuration Steps
1. Add `AUTUMN_SECRET_KEY` to Convex environment.
2. Add Autumn’s Convex component in `convex/convex.config.ts`.
3. Create `convex/autumn.ts` to initialize Autumn with `identify`.
   - `identify` should return:
     - `customerId`: stable user ID (use Clerk subject)
     - `customerData`: name, email
     - `fingerprint`: hashed device or IP identifier (for trial abuse control)
4. Re-export Autumn API helpers (`checkout`, `attach`, `check`, `track`, `query`, `billingPortal`, etc).

## 5. Backend Usage Enforcement
All access checks and usage tracking must be server-side in Convex actions/mutations.

Flow per image generation
1. Before generating an image, call `check` for `images_generated`:
   - `required_balance: 1` (or N if generating multiple images).
   - Use `send_event: true` to atomically reserve usage when concurrency matters.
2. If generation fails, “refund” usage via `track` with a negative value.
3. If generation succeeds and no reservation was used, call `track` with value `1`.

This eliminates race conditions and keeps balances consistent.

## 6. Billing UI and UX
Pricing page
- Call a Convex action that wraps `checkout` with `product_id` = plan ID.
- If `checkout` returns `url`, redirect to Stripe Checkout.
- If no `url`, show confirmation UI with the preview data, then call `attach`.

Billing page
- Use Autumn’s `query` or `customer` data to render:
  - Active plan
  - Remaining `images_generated` balance
  - Next reset date
- Provide “Manage Billing” button that calls `billingPortal`.

Success flow
- After Stripe Checkout success, redirect to `/billing/success`.
- On success page, call a server action that refreshes customer state using Autumn.

## 7. Data Model Changes
We should phase out the AbacatePay-specific tables and subscription logic.

Plan
- Remove AbacatePay tables and `user_subscriptions` usage gating logic.
- Keep any historical data only if needed for analytics.
- Update any UI that references `user_subscriptions` to instead use Autumn’s customer data.

## 8. Migration Strategy (If There Are Existing Paid Users)
If there are existing subscribers:
- Create Autumn customers for each user (API or dashboard).
- Attach the correct plan in Autumn.
- If remaining time should be honored, use plan overrides or custom trial periods.
- Communicate billing cutover clearly (email + in-app message).

If there are no paid users yet, skip migration and go live cleanly.

## 9. Testing Plan
Sandbox
- Verify `checkout` returns a Stripe Checkout URL for new users.
- Verify `checkout` returns preview data for existing users with a card.
- Validate trial activation and expiry for Basico.
- Confirm `check` and `track` correctly reflect balances and resets.

Live
- Single internal purchase with real card.
- Verify billing portal access.
- Verify trial behavior if card not required.

## 10. Rollout Checklist
- Autumn plans configured and reviewed.
- Stripe default currency set to BRL.
- Convex + Autumn integration complete.
- Pricing UI uses `checkout` + `attach`.
- Generation actions gate via `check` + `track`.
- Billing page uses Autumn data + billing portal.
- Remove AbacatePay remnants from code and schema.
- End-to-end test in sandbox and live.

## TODO Checklist
- [x] Install Autumn dependencies (`@useautumn/convex`, `autumn-js`).
- [ ] Create Autumn account and connect Stripe (BRL currency, portal enabled).
- [ ] Create Autumn feature `images_generated` (metered + consumable, monthly).
- [ ] Create Autumn plans `basico`, `mediano`, `profissional` with prices and monthly limits.
- [ ] Enable 7‑day card-required trial on `basico`.
- [ ] Add `AUTUMN_SECRET_KEY` to Convex env and local `.env`.
- [x] Add Autumn Convex component and initialization (`convex/convex.config.ts`, `convex/autumn.ts`).
- [x] Implement `identify` mapping (Clerk subject → customerId, include name/email).
- [x] Add per-user `fingerprint` generation (hash of device or IP).
- [x] Create Convex actions: `startCheckout(planId)`, `attachPlan(productId)`.
- [x] Create Convex action: `getBillingPortalUrl()`.
- [x] Create Convex query: `getAutumnCustomer()` for UI state.
- [x] Replace legacy subscription queries in UI with Autumn data.
- [x] Update pricing page to call `startCheckout` and handle preview/attach flow.
- [x] Update billing page to show plan, balance, reset date, and billing portal link.
- [x] Update success page to call a server action that refreshes Autumn customer state.
- [x] Update image generation actions to gate with `check` before work.
- [x] Update image generation actions to `track` on success and refund on failure.
- [x] Add server-side enforcement for batch generation (reserve N images).
- [x] Remove AbacatePay client-side code, routes, and UI wiring (if any remain).
- [x] Remove AbacatePay Convex actions, webhooks, and helpers.
- [x] Remove AbacatePay tables and fields from Convex schema.
- [x] Replace legacy `user_subscriptions` access logic with Autumn checks.
- [ ] Update tests to cover Autumn usage checks and trial flow.
- [ ] Add a sandbox end‑to‑end test for checkout + entitlement update.
- [ ] Add a live smoke test script/checklist for production release.
