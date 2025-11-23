# Repository Guidelines

## Project Structure & Module Organization
- `app/` hosts the Next.js App Router entry points such as `layout.tsx`, shared styles, and `page.tsx`, which renders the marketing experience.
- `convex/` contains Convex backend functions and should mirror any client-facing actions with matching server logic.
- `public/` stores static assets (favicons, imagery) served verbatim.
- Root config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `tailwind` configs) control build, lint, and styling defaults—update them in tandem with feature changes.

## Build, Test, and Development Commands
- `bun install` (or `npm install`) restores dependencies; prefer Bun to stay aligned with the existing `bun.lock`.
- `bun run dev` starts the local Next.js server with hot reload at `http://localhost:3000`.
- `bun run build` compiles the production bundle and checks for type errors.
- `bun run start` serves the optimized build; use this to reproduce production behavior.
- `bun run lint` executes ESLint with the Next.js config to enforce repo conventions.

## Coding Style & Naming Conventions
- TypeScript with ES modules is mandatory; keep components typed and leverage hooks for client state.
- Follow Tailwind utility classes for styling; group semantic chunks logically instead of duplicating custom CSS.
- Keep filenames kebab-case or camelCase (`ConvexClientProvider.tsx` already exported).
- Maintain two-space indentation and concise React components; extract helpers when JSX exceeds ~80 lines.
- Run `bun run lint` before submitting to ensure consistent formatting and catch unused imports or hooks-rule violations.

## Testing Guidelines
- Automated tests are not yet configured; prioritize manual verification in the browser plus Convex dashboard when touching backend logic.
- When adding automated coverage, colocate tests next to modules using `*.test.ts` and document the command you introduce (e.g., `bun test`).
- Smoke-test critical flows (sign-in via Clerk, prompt submission, Convex mutations) before opening a PR.

## Commit & Pull Request Guidelines
- Use imperative, 72-character subject lines (`feat: add PT-BR hero copy`) followed by optional detail in the body.
- Reference related issues in the PR description and include screenshots or Loom recordings for UI-affecting changes.
- Ensure CI (lint/build/manual tests) is green before requesting review, and describe any remaining risks or follow-up tasks explicitly.
