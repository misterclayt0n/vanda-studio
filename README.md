# Vanda Studio

TanStack Start app backed by Clerk, Convex, Autumn, OpenRouter, Vercel, and the Instagram Graph API.

## Development

```bash
corepack pnpm install
corepack pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Set local app variables in `.env.local`:

- `VITE_CONVEX_URL` or `PUBLIC_CONVEX_URL`: Convex deployment URL.
- `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`: Clerk auth.
- `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`: Instagram app credentials.
- `INSTAGRAM_TOKEN_ENCRYPTION_KEY`: Secret used to encrypt stored Instagram tokens.
- `VITE_APP_ORIGIN`: Public app origin. Production uses `https://app.vandastudio.app`.
- `VITE_INSTAGRAM_REDIRECT_URI`: Optional exact OAuth redirect URI to send to Meta.

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

For local OAuth testing, use a stable public HTTPS URL that is listed in Meta, then set:

```bash
VITE_INSTAGRAM_REDIRECT_URI=https://your-stable-dev-url.example.com/api/integrations/instagram/callback
```

Random tunnel URLs work only until the hostname changes. Prefer a named Cloudflare tunnel or a stable preview/dev URL.

## Checks

```bash
corepack pnpm run check
corepack pnpm run build
```
