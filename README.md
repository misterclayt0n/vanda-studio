# Vanda Studio

Monorepo for Vanda Studio.

- `apps/landing`: Astro static landing site for `vandastudio.app`.
- `apps/vanda`: TanStack Start app for `app.vandastudio.app`.
- `packages/ui`: shared UI primitives.

## Development

```bash
corepack pnpm install
corepack pnpm run dev:landing
corepack pnpm run dev:vanda
```

Landing runs on [http://localhost:3001](http://localhost:3001).
The app runs on [http://localhost:3000](http://localhost:3000).

## Deployment

Use two Vercel projects from the same repository:

- Landing project root directory: `apps/landing`, domain: `vandastudio.app`.
- App project root directory: `apps/vanda`, domain: `app.vandastudio.app`.

The app project should keep the existing Clerk, Convex, Autumn, OpenRouter, and Instagram environment variables.

### Release workflow

`main` is the only long-lived branch. Feature branches are tested locally and can be
deployed to the shared integration slot with the **Deploy staging** GitHub Actions
workflow. Enter a branch, tag, or commit SHA when starting the workflow.

- `staging.vandastudio.app` runs the selected revision against the development Convex
  deployment and is reserved for test Instagram accounts.
- `app.vandastudio.app` runs `main` against the production Convex deployment.
- **Deploy production** is manually triggered from `main`. It deploys Convex first,
  creates a staged Vercel production deployment, and promotes it only after the build
  succeeds.

Vercel Git deployments are disabled for `apps/vanda`; the workflows own app deployment
ordering. The landing project remains independent.

Required GitHub environment secrets:

- `staging`: `CONVEX_DEV_DEPLOY_KEY`, `VERCEL_TOKEN`
- `production`: `CONVEX_PROD_DEPLOY_KEY`, `VERCEL_TOKEN`

Required GitHub environment variables in both environments:

- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `CONVEX_DEV_URL` (staging only)

## Environment

Set local app variables in the repo root `.env.local`. `apps/vanda/vite.config.ts` points Vite at the repo root env directory.

- `VITE_CONVEX_URL` or `PUBLIC_CONVEX_URL`: Convex deployment URL.
- `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`: Clerk auth.
- `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`: Instagram app credentials.
- `INSTAGRAM_TOKEN_ENCRYPTION_KEY`: Secret used to encrypt stored Instagram tokens.
- `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`: Secret string Meta sends during Instagram webhook setup.
- `VITE_APP_ORIGIN`: Public app origin. Production uses `https://app.vandastudio.app`.
- `VITE_INSTAGRAM_REDIRECT_URI`: Optional exact OAuth redirect URI to send to Meta when
  running from `localhost`.

Convex-side secrets should also be configured in the Convex deployment when needed.

## Instagram OAuth

Meta validates `redirect_uri` by exact match against the Instagram app's configured OAuth redirect URIs. The app defaults to:

```text
<current-origin>/api/integrations/instagram/callback
```

Production uses the app subdomain:

```text
https://app.vandastudio.app/api/integrations/instagram/callback
```

For local OAuth testing, use a public HTTPS URL that is listed in Meta. If you open the app
through a Cloudflare/ngrok tunnel, the app uses that tunnel origin automatically:

```text
https://your-tunnel.example.com/api/integrations/instagram/callback
```

If you open the app through `localhost`, set the callback explicitly:

```bash
VITE_INSTAGRAM_REDIRECT_URI=https://your-stable-dev-url.example.com/api/integrations/instagram/callback
```

Restart the Vite dev server after changing `.env.local`; Vite inlines `VITE_*` values at
server start. Random tunnel URLs work only until the hostname changes. Prefer a named
Cloudflare tunnel or a stable preview/dev URL.

## Instagram Webhooks

The Convex HTTP endpoint for Meta Instagram webhooks is:

```text
https://<your-convex-deployment>.convex.site/integrations/instagram/webhook
```

Configure the Meta App Dashboard Webhooks product with that callback URL and the same
`INSTAGRAM_WEBHOOK_VERIFY_TOKEN` value set in Convex. The app subscribes connected
Instagram professional accounts to `comments,mentions` during OAuth, while the existing
observe cron remains as backfill/reconciliation.

## Checks

```bash
corepack pnpm run typecheck
corepack pnpm run lint
corepack pnpm run build
```
