# Auto-generate 5 posts after project creation — implementation plan

## Goal

Add a project-level feature that lets the user generate **5 Instagram posts** and automatically **schedule them in the calendar** after a project is created.

This should:
- appear as a button on the project page, e.g. **"Gerar 5 posts"**
- use the app's **existing infrastructure** for image generation, caption creation, post persistence, and scheduling
- be **one run per project only**
- require that the project has already completed an **Instagram capture**
- consume credits for **all LLM calls** involved in the flow

---

## Product decisions

Based on the latest decisions:

1. **Default schedule time**
   - Use **12:00** as the default scheduled time for all generated posts.

2. **Instagram requirement**
   - The feature should only be available if the project has already gone through **Instagram capture**.
   - No generation without capture.

3. **One run only**
   - This is a demo feature and also expensive.
   - The generation flow should be allowed **only once per project**.

4. **Credits**
   - **All LLM calls consume credits**, including idea generation / planning steps.

---

## What exists today

### Project creation flow
- New projects are created from `src/routes/projects/new/+page.svelte`
- That page calls `api.projects.create`
- If the onboarding path is based on an existing brand, it then calls `api.instagram.fetchProfile`
- The user is then redirected to `src/routes/projects/[projectId]/+page.svelte`

### Best place for the new button
The project page already has a `Vanda sugere` section in:
- `src/routes/projects/[projectId]/+page.svelte`

This is the best place to add a real CTA for:
- `Gerar 5 posts`

### Existing creation infrastructure
There are two relevant generation flows:

#### 1. The modern composer/media flow
- `src/convex/ai/composePostFromBrief.ts`
- Generates **media_items + caption**
- Works with the current media-library/post-composer model

Posts are then persisted with:
- `src/convex/generatedPosts.ts` → `saveComposedDraft`

This is the best infrastructure to reuse.

#### 2. The current ideation flow
- `src/convex/ai/postIdeas.ts`
- Already knows how to generate multiple ideas using:
  - project brand context
  - Instagram digest
  - recent synced captions
- But today it writes placeholder `generated_posts` directly and does **not** generate final media

This makes it useful as a **planning layer**, but not suitable as-is for the final user-facing feature.

### Existing scheduling infrastructure
Scheduling is already implemented in:
- `src/convex/scheduledPosts.ts`

The main entry point is:
- `schedulePost`

That mutation already:
- updates `generated_posts` with `scheduledFor`, `schedulingStatus`, `reminderMinutes`
- creates `calendar_events`

### Existing calendar sync infrastructure
Google Calendar integration already exists in:
- `src/convex/googleCalendar.ts`
- `src/convex/crons.ts`

Important detail:
- immediate Google sync currently happens from the UI flow in `src/lib/components/calendar/ScheduleModal.svelte`
- for this new feature, scheduling happens in the backend, so backend-triggered sync is needed too

---

## Recommended implementation

## 1. Add a dedicated orchestration module

Create a new backend module to orchestrate the entire flow, for example:
- `src/convex/projectAutoPosts.ts`

Responsibilities:
- verify project ownership
- verify the project is eligible
- generate 5 distinct ideas
- create media + captions using existing infrastructure
- persist real posts
- schedule them at 12:00 on future dates
- optionally trigger Google Calendar sync

This should be the single entry point for the feature.

---

## 2. Add one-run-per-project tracking

Because the feature is expensive and should only be used once per project, add persistent tracking in the schema.

### Recommended schema addition
Add fields to `projects` in `src/convex/schema.ts`, for example:
- `launchPostsGeneratedAt?: number`
- `launchPostsBatchId?: Id<"project_post_generation_batches">`

And add a batch table, e.g.:
- `project_post_generation_batches`

Suggested fields:
- `userId`
- `projectId`
- `status` = `pending | generating | completed | partial | error`
- `totalPosts`
- `completedPosts`
- `generatedPostIds`
- `scheduledPostIds`
- `errorMessage?`
- `createdAt`
- `updatedAt`

### Why both project fields and batch table
Project-level fields are useful for:
- enforcing **one run only**
- disabling the button quickly in UI

Batch-level data is useful for:
- progress UI
- debugging partial failures
- auditability for this demo flow

---

## 3. Gate the feature behind Instagram capture

The button should only become active if the project has already completed Instagram capture.

This can be derived from existing data such as:
- `project.lastInstagramSyncAt`
- `project.instagramContentDigest`

### Recommended rule
A project is eligible only if:
- `lastInstagramSyncAt` exists
- `instagramContentDigest` exists
- `launchPostsGeneratedAt` does **not** exist
- there is no currently running generation batch

If those conditions are not met:
- show the button disabled or hide it
- explain why

Examples:
- `Capture o Instagram antes de gerar os posts.`
- `Os 5 posts deste projeto já foram gerados.`

---

## 4. Refactor ideation so it returns ideas without persisting placeholder posts

`src/convex/ai/postIdeas.ts` already contains the right intelligence for generating distinct post directions, especially because it uses:
- `brandContextMarkdown`
- `instagramContentDigest`
- recent synced post snippets
- anti-repetition logic

### Problem today
It currently inserts `generated_posts` directly.

### Recommended change
Extract the core LLM ideation logic into a reusable helper that returns an array like:
- `title`
- `caption` or caption direction
- `reasoning`
- `imagePrompt` or visual direction
- `sourcePostIndices`

Then:
- reuse that helper inside this new orchestration flow
- ensure the ideation step itself also reserves/consumes credits

### Important
Because all LLM calls consume credits, this ideation step must be treated like a billable AI action.

---

## 5. Reuse the modern compose pipeline for final assets

For each of the 5 generated ideas, reuse:
- `src/convex/ai/composePostFromBrief.ts`

This action already:
- generates image assets into `media_items`
- generates a caption
- works with project context
- is aligned with the current architecture

### Recommended per-post flow
For each idea:
1. build a brief from the idea
2. call `composeFromBrief`
3. receive:
   - `mediaItemIds`
   - `caption`
4. persist the actual post through:
   - `api.generatedPosts.saveComposedDraft`

Arguments should include:
- `projectId`
- `title`
- `caption`
- `mediaItemIds`
- `platform: "instagram"`

### Why this is the right path
This avoids using older post/image coupling and keeps the feature aligned with the newer:
- `media_items`
- `post_media_items`
- `saveComposedDraft`

---

## 6. Keep v1 simple: single-image Instagram posts

For the first version, generate:
- **5 single-image Instagram posts**

Do **not** start with:
- carousels
- template selection
- advanced editorial layouts
- mixed formats

### Why
This keeps the demo:
- cheaper
- faster
- more reliable
- easier to reason about

The generated posts should still remain editable afterwards in the existing composer.

---

## 7. Automatically schedule the 5 posts

After each post is persisted, schedule it using:
- `api.scheduledPosts.schedulePost`

### Recommended scheduling strategy
- schedule the posts on the **next 5 weekdays**
- use **12:00** local time
- set a default reminder if desired, e.g. `30` minutes

This ensures the posts appear automatically in:
- `/calendar`
- `/posts`
- project-related views using scheduled data

### Example schedule
If the batch runs on a Monday:
- Tue 12:00
- Wed 12:00
- Thu 12:00
- Fri 12:00
- Mon 12:00

---

## 8. Trigger backend Google Calendar sync

After scheduling a post:
- if Google Calendar is connected and sync is enabled, trigger backend sync immediately

### Why
Current immediate sync happens in:
- `src/lib/components/calendar/ScheduleModal.svelte`

This feature bypasses that UI, so backend sync must happen inside the orchestration flow.

### Recommended behavior
For each scheduled post:
- call the backend-safe Google sync path
- if sync fails, the post should still remain scheduled in Vanda
- cron-based retry can still recover pending syncs later

This matches current system behavior and avoids blocking the feature on Google errors.

---

## 9. Add the project page CTA and progress UI

Update:
- `src/routes/projects/[projectId]/+page.svelte`

### UI changes
Replace one of the current placeholder suggestion cards with a real action:
- title: `Gerar 5 posts`
- description: something like `Cria imagens, legendas e agenda no calendário.`

### UI states
The page should support:
- eligible / idle
- generating
- completed
- partial / error
- blocked because Instagram capture is missing
- blocked because the project already used the one allowed run

### Example labels
- idle: `Gerar 5 posts`
- generating: `Gerando 2 de 5...`
- completed: `5 posts criados e agendados`
- blocked: `Disponível após capturar o Instagram`

---

## 10. Error handling strategy

This feature spans several expensive operations, so partial failures are possible.

### Recommended approach
The batch should continue per item when possible.

Examples:
- if idea 4 image generation fails, the batch may still complete 4/5 posts
- if Google Calendar sync fails for one post, the post should still remain scheduled in-app

### Batch status policy
- `completed` → all 5 created and scheduled
- `partial` → some posts created/scheduled, some failed
- `error` → batch failed before any useful output

This is especially important for a demo feature, because it gives a clearer result than a single all-or-nothing failure.

---

## Suggested execution flow

1. User creates project
2. Instagram capture completes
3. User lands on `/projects/[projectId]`
4. User sees `Gerar 5 posts`
5. User clicks button
6. Backend validates:
   - ownership
   - Instagram capture completed
   - not already used
   - no batch currently running
7. Backend creates batch record
8. Backend generates 5 distinct ideas using project + Instagram context
9. For each idea:
   - generate image + caption with `composePostFromBrief`
   - persist post with `saveComposedDraft`
   - schedule post with `schedulePost`
   - try immediate Google Calendar sync if connected
10. Batch record updates progress live
11. Project page shows progress and final status
12. Final posts appear in calendar and post views
13. Project is marked as having already used its single demo run

---

## File-by-file implementation outline

### Frontend
- `src/routes/projects/[projectId]/+page.svelte`
  - add CTA card
  - query batch/progress state
  - disable/hide button based on eligibility

### Schema
- `src/convex/schema.ts`
  - add project-level one-run tracking fields
  - add `project_post_generation_batches` table

### New backend orchestration
- `src/convex/projectAutoPosts.ts`
  - create batch
  - run ideation
  - create posts
  - schedule posts
  - sync calendar
  - mark project as consumed

### AI ideation refactor
- `src/convex/ai/postIdeas.ts`
  - extract helper to generate ideas without persisting draft posts
  - ensure ideation uses credits

### Reused existing infrastructure
- `src/convex/ai/composePostFromBrief.ts`
- `src/convex/generatedPosts.ts`
- `src/convex/scheduledPosts.ts`
- `src/convex/googleCalendar.ts`

---

## Final recommendation for v1

Build the narrowest version that demonstrates the full story well:

- one button on the project page
- requires completed Instagram capture
- generates exactly 5 single-image Instagram posts
- schedules them at 12:00 on the next 5 weekdays
- uses existing compose/save/schedule infrastructure
- charges credits for every AI step
- can only run once per project

This gives a clean demo without fighting the current architecture.
