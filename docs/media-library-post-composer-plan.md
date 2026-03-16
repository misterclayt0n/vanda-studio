# Media Library and Post Composer Refactor Plan

## Summary

This refactor separates two concepts that are currently mixed together:

1. Images are assets.
2. Posts are compositions that use assets.

Today the app treats `generated_posts` as both the publishable post and the container for AI image outputs. That creates the UX problem on `/posts/create`, makes `/gallery` behave like a post browser instead of an image library, and forces edited images to become synthetic posts just so they can appear in the gallery.

The target state is:

- One image workspace that merges gallery + image generation.
- One post composer that assembles existing images into publishable posts.
- Project association continues to exist for both images and posts.
- Image editing remains iterative, but its outputs become images, not fake posts.

## Product Goals

- Make image generation a first-class workflow independent from post creation.
- Make the gallery useful as a working image library, not only as post history.
- Let users generate images, upload/import images, browse images, refine images, and reuse images from one place.
- Let `/posts/create` focus on composing a post from existing assets plus caption/scheduling data.
- Preserve project scoping so teams can organize both assets and posts by client/account.

## Current State Audit

The current implementation already shows where the coupling lives:

- `src/routes/posts/create/+page.svelte`
  - Starts from a post-generation mental model.
  - Calls `api.ai.chat.generate`, which creates a `generated_post` first and only then generates images.
  - The left sidebar already contains the controls we want for image generation.

- `src/routes/gallery/+page.svelte`
  - Loads `generated_posts`, then expands each post into one gallery card per `generated_image`.
  - This means the gallery is not truly image-native; it is a transformed view of posts.

- `src/convex/ai/chat.ts`
  - A single action owns both caption generation and image generation.
  - Every image generation flow creates a `generated_posts` record, even when the user mainly wants images.

- `src/convex/imageEditOutputs.ts`
  - Each edit output creates:
    - an `image_edit_outputs` record,
    - a synthetic `generated_posts` record,
    - a linked `generated_images` record.
  - This is the clearest sign that posts are currently being used as image containers.

- `src/convex/scheduledPosts.ts`, `src/routes/calendar/+page.svelte`, `src/lib/components/calendar/ScheduleModal.svelte`
  - Scheduling is correctly attached to posts.
  - The problem is that some "posts" currently exist only because the image system needs them.

- `src/convex/schema.ts`
  - Image-related data is split across multiple concepts:
    - `generated_images`
    - `image_edit_outputs`
    - `reference_images`
    - `context_images`
  - Post-related data lives in `generated_posts`.
  - There is no canonical "user image library" entity.

## Target Domain Model

The system should have two explicit primary domains.

### 1. Images

Images are reusable assets. They may come from:

- AI generation
- user upload/import
- image edit conversations
- future external imports

Images can belong to a project, but they do not imply a publishable post.

Recommended canonical table:

`media_items` or `library_images`

Recommended fields:

- `userId`
- `projectId?`
- `storageId`
- `mimeType`
- `width`
- `height`
- `sourceType` = `generated | uploaded | edited | imported`
- `model?`
- `prompt?`
- `aspectRatio?`
- `resolution?`
- `parentMediaId?`
- `sourceConversationId?`
- `sourceTurnId?`
- `sourceOutputId?`
- `deletedAt?`
- `createdAt`
- `updatedAt`

Recommendation: use a new canonical image table instead of stretching `generated_images` further. The current table name and ownership model are tied to posts.

### 2. Posts

Posts are publishable compositions. A post should own:

- caption
- scheduling state
- platform intent
- optional project association
- selected image references

Recommended tables:

- `posts` or `post_compositions`
- `post_media_items`

Recommended post fields:

- `userId`
- `projectId?`
- `caption`
- `platform`
- `status` = `draft | scheduled | posted | archived`
- `brief?`
- `scheduledFor?`
- `schedulingStatus?`
- `reminderMinutes?`
- `createdAt`
- `updatedAt`
- `deletedAt?`

Recommended join table fields:

- `postId`
- `mediaItemId`
- `position`
- `role` = `cover | attachment`

Recommendation: support multiple images at the data level now, even if the first UI version behaves like a single-image post. That keeps the model ready for carousels.

## Route and UX Plan

### A. Image Workspace

Primary purpose: browse and generate images in one place.

Recommended route:

- New primary route: `/images`
- Temporary alias or redirect: `/gallery -> /images`

UX structure:

- Left sidebar: reuse the current `/posts/create` controls for prompt, project, brand context toggle, model selection, aspect ratio, resolution, reference uploads.
- Main area: image-native grid, closer to the T3 Chat canvas pattern.
- Default state: immediately show existing user images.
- New generations: appear inline at the top of the grid as pending skeletons, then resolve into real assets.
- Project filter: available at the workspace level.
- Search: image prompt, model, project, and maybe caption references later.
- Asset actions:
  - open
  - download
  - refine
  - add to post
  - move/change project
  - soft delete

Important behavioral change:

- Generating an image from this page must not create a post.

### B. Post Composer

Primary purpose: assemble a publishable post from existing assets.

Recommended route:

- Keep `/posts/create`, but redefine it as a post composer.
- Optional future rename: `/posts/compose`

UX structure:

- Post brief / caption prompt / caption editor
- Project selection
- Platform selection
- Asset picker pulling from the user image library
- Support for:
  - images from the current project
  - images from all projects
  - uploaded images
  - AI-generated images from the image workspace
- Scheduling remains here, because scheduling is a post concern.

Important behavioral change:

- "Generate image" inside the composer should never create an implicit post.
- If the composer offers image generation, it should create an image asset first, then attach that asset to the draft post.

### C. Image Editing Conversations

Recommended route move:

- `/posts/edit/[conversationId]` -> `/images/conversations/[conversationId]`

Reason:

- These are image workflows, not post workflows.

Behavior change:

- Edit outputs should create image assets in the library.
- They should not create synthetic posts.
- The conversation page should keep working as an image refinement workspace with history and outputs.

### D. Project Pages

Current project detail is post-centric. After the refactor it should expose both domains.

Recommended project tabs:

- `Images`
- `Posts`
- `Settings`

Behavior:

- Images tab shows project-scoped library assets.
- Posts tab shows composed posts for the project.
- Settings keeps the current brand context settings.

### E. Navigation

Current navbar labels make sense only while image creation lives inside post creation.

Recommended nav structure:

- `Imagens` -> merged image workspace
- `Posts` or `Criar post` -> post composer
- `Calendario`
- `Projetos`

If the `Criar` label remains, it should point to the image workspace only if image creation is the default creation action. Otherwise it will stay ambiguous.

## Data and Schema Refactor

### Phase 1: Introduce New Canonical Image Model

Add the new image library table and keep legacy tables running during migration.

Rules:

- Every newly generated AI image writes to the new image table.
- Every newly uploaded user image writes to the new image table.
- Every new edit output writes to the new image table.
- No new code path should require a post just to persist an image.

Keep these concepts separate:

- `context_images`
  - brand guidance for projects
  - not necessarily reusable publishable assets

- `media_items` / canonical library images
  - reusable visual assets
  - can appear in gallery, composer, and edit flows

Recommendation:

- Deprecate `reference_images` as a permanent storage concept.
- Replace it with:
  - temporary prompt attachments for generation, and
  - real library uploads when the user intends to keep the image.

### Phase 2: Introduce Post-to-Image Composition

Add a post table plus join table, or migrate `generated_posts` into a real post table through a compatibility layer.

Rules:

- A post references image assets.
- A post never owns image binary storage directly.
- Deleting a post must not delete the underlying reusable image assets.
- Scheduling only targets posts.

Recommendation:

- Do not keep `imageStorageId` on the post as the source of truth.
- If needed for transitional performance, store a denormalized preview image id or url, but keep the relation canonical through `post_media_items`.

### Phase 3: Move Image Editing to the Image Domain

Update:

- `image_edit_conversations.sourceImageId`
- `image_edit_outputs`

So they point to canonical library images instead of `generated_images` owned by posts.

Lineage should become:

- original image asset
- conversation
- turn
- output asset

Not:

- original post
- synthetic edited post

### Phase 4: Migrate Scheduling and Calendar

Calendar remains post-based, but now only for real posts.

Update:

- `scheduledPosts.ts`
- Google Calendar sync
- schedule modal entry points

Behavior change:

- Asset lightboxes should no longer say "Agendar post" directly.
- Instead they should say:
  - `Usar em post`
  - `Criar post com esta imagem`

That action opens the composer with the image preselected.

## Migration Strategy

This should be an incremental migration, not a big-bang rewrite.

### Step 1: Add New Tables and Dual Writes

- Add canonical image table.
- Add canonical post composition tables.
- Keep legacy reads working.
- For all new image generation/edit/upload flows, dual-write if necessary during transition.

### Step 2: Backfill Existing Data

Backfill library images from:

- `generated_images`
- legacy `generated_posts.imageStorageId`
- `image_edit_outputs`

Backfill posts from:

- `generated_posts`

Backfill post-image links from:

- `generated_images`
- legacy primary image fields

Important edge case:

- Edited images that were previously represented as synthetic posts should become image assets with lineage metadata.
- If those synthetic posts were scheduled, treat them as real posts during migration and preserve their scheduling data.

### Step 3: Cut Over Read Paths

Switch these areas to new reads:

- merged image workspace
- image lightbox
- image editing conversations
- post composer
- project image tab
- project post tab
- calendar

### Step 4: Remove Legacy Coupling

After the new flows are stable:

- stop creating `generated_posts` from image-only flows
- stop using `generated_images` as the gallery source of truth
- remove synthetic post creation from `imageEditOutputs.create`
- remove gallery queries that expand posts into images

## API and Service Changes

### Image Generation API

Split the current monolithic generate action into two concepts:

- `generateImageBatch`
- `generatePostCaption` or `generatePostDraft`

Recommended behavior:

- Image generation writes image assets plus batch metadata.
- Caption generation writes to post drafts or returns text to the composer.
- The composer may orchestrate both, but the underlying services stay separate.

### Query Layer

Add image-native queries:

- `listMediaByUser`
- `listMediaByProject`
- `searchMedia`
- `getMedia`
- `softDeleteMedia`
- `restoreMedia`

Keep post-native queries separate:

- `listPostsByUser`
- `listPostsByProject`
- `searchPosts`
- `getPostWithMedia`

## UX Rollout Plan

### Phase A: New Image Workspace

- Build the merged gallery + generation page first.
- Keep old `/posts/create` alive during this phase if needed.
- Prove that image generation, browsing, and editing no longer need a post record.

### Phase B: New Post Composer

- Build a composer that consumes existing image assets.
- Add "create post from image" entry points from the image workspace and lightbox.
- Keep scheduling and caption editing here.

### Phase C: Project and Navigation Cleanup

- Update project pages to show separate tabs for images and posts.
- Rename navigation so the mental model matches the new product.
- Redirect old routes.

## Non-Goals for the First Iteration

- Do not redesign the entire visual language from scratch.
- Do not solve video/media parity in the first pass, even if the table name is future-proofed.
- Do not merge project context images into the library by default.
- Do not rebuild the scheduling system beyond retargeting it to real posts.

## Success Criteria

- A user can open the image workspace and immediately see their images without entering a post flow.
- A user can generate new images without creating a post.
- A user can upload/import images into the same workspace.
- A user can refine an image and the result shows up as an image asset, not a fake post.
- A user can create a post by selecting one or more existing images from the library.
- A user can schedule a post without the scheduling system depending on image-generation records.
- A project can contain both images and posts, each queryable independently.

## Risks

- Legacy records mix "real posts" and "image carrier posts", so migration must preserve scheduled content carefully.
- Calendar, trash, and project pages currently assume posts are the root object for many visual workflows.
- Search currently relies on post fields like `caption` and `imagePrompt`; image search needs its own indexing strategy.
- Deletion semantics must be redesigned so deleting a post does not accidentally delete reusable assets.

## Open Questions To Resolve Before Implementation

- Should the merged image workspace replace `/gallery`, or should `/gallery` remain as the canonical route and absorb the sidebar?
- Should the first post composer version support multi-image carousel composition, or only single-image posts with a multi-image-ready schema?
- When a user uploads an image while composing a post, should that upload always be saved to the library first?
- Should project context images stay fully separate from library images, or should the user be able to promote a context image into the library?
- Do we want a unified trash for images and posts, or separate trash views for each domain?

## Recommended Implementation Order

1. Add canonical image library schema and queries.
2. Stop image-only flows from requiring post creation.
3. Build the merged image workspace.
4. Move image edit conversations under the image domain and remove synthetic post creation.
5. Add post composition schema that references library images.
6. Rebuild `/posts/create` as a real composer.
7. Retarget calendar, project pages, and lightboxes to the new model.
8. Migrate legacy data and remove compatibility paths.
