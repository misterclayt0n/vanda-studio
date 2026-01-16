# Image Editing Conversations - Implementation Plan

## Overview

Add a feature allowing users to start editing conversations from any generated image. Users click "Edit" on an image thumbnail, configure the edit in a modal, then navigate to a dedicated conversation page where they can iteratively refine the image through multiple turns.

---

## Phase 1: Schema Changes

### New Table: `image_edit_conversations`

```typescript
// src/convex/schema.ts

image_edit_conversations: defineTable({
    userId: v.id("users"),
    
    // Source image (the image being edited)
    sourceImageId: v.id("generated_images"), // Links to generated_images table
    sourceImageUrl: v.optional(v.string()), // Cached URL for quick access
    
    // Conversation metadata
    title: v.string(), // Auto-generated from first prompt
    
    // Generation settings (persisted across turns)
    imageModels: v.array(v.string()), // Models to use
    aspectRatio: v.string(), // "1:1", "16:9", etc.
    resolution: v.string(), // "standard", "high", "ultra"
    
    // Counts for display
    turnCount: v.number(),
    
    // Status
    status: v.string(), // "active" | "generating" | "completed"
    
    createdAt: v.number(),
    updatedAt: v.number(),
})
.index("by_user_id", ["userId"])
.index("by_source_image", ["sourceImageId"])
.index("by_created_at", ["createdAt"]),
```

### New Table: `image_edit_turns`

```typescript
// src/convex/schema.ts

image_edit_turns: defineTable({
    conversationId: v.id("image_edit_conversations"),
    turnNumber: v.number(), // 1, 2, 3...
    
    // User input
    userMessage: v.string(), // The edit instruction
    
    // Reference images for this turn (auto-populated from previous turn + manual)
    referenceImageIds: v.array(v.id("_storage")), // Previous turn's images + any manual refs
    manualReferenceImageIds: v.optional(v.array(v.id("_storage"))), // User-uploaded refs
    
    // Generation settings (can override conversation defaults)
    imageModels: v.array(v.string()),
    aspectRatio: v.string(),
    resolution: v.string(),
    
    // Generated images for this turn (one per model)
    // Progressive loading support
    pendingModels: v.optional(v.array(v.string())),
    totalModels: v.optional(v.number()),
    
    // Status
    status: v.string(), // "pending" | "generating" | "completed" | "failed"
    error: v.optional(v.string()),
    
    createdAt: v.number(),
})
.index("by_conversation", ["conversationId"])
.index("by_conversation_turn", ["conversationId", "turnNumber"]),
```

### New Table: `image_edit_outputs`

```typescript
// src/convex/schema.ts

image_edit_outputs: defineTable({
    turnId: v.id("image_edit_turns"),
    conversationId: v.id("image_edit_conversations"), // Denormalized for efficient queries
    
    storageId: v.id("_storage"),
    model: v.string(),
    prompt: v.string(), // The full prompt sent to the model
    
    width: v.number(),
    height: v.number(),
    
    createdAt: v.number(),
})
.index("by_turn", ["turnId"])
.index("by_conversation", ["conversationId"]),
```

---

## Phase 2: Backend Implementation

### File: `src/convex/imageEditConversations.ts`

```typescript
// Queries
export const get = query({
    args: { id: v.id("image_edit_conversations") },
    handler: async (ctx, args) => {
        // Get conversation with source image URL resolved
        // Verify user ownership
    },
});

export const listByUser = query({
    args: {},
    handler: async (ctx) => {
        // List all conversations for current user
        // Include source image thumbnails
        // Order by updatedAt desc
    },
});

// Mutations
export const create = mutation({
    args: {
        sourceImageId: v.id("generated_images"),
        title: v.string(),
        imageModels: v.array(v.string()),
        aspectRatio: v.string(),
        resolution: v.string(),
    },
    handler: async (ctx, args) => {
        // Verify user owns the source image
        // Create conversation record
        // Return conversation ID
    },
});

export const updateTitle = mutation({
    args: {
        id: v.id("image_edit_conversations"),
        title: v.string(),
    },
    handler: async (ctx, args) => {
        // Update conversation title
    },
});

export const updateSettings = mutation({
    args: {
        id: v.id("image_edit_conversations"),
        imageModels: v.optional(v.array(v.string())),
        aspectRatio: v.optional(v.string()),
        resolution: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Update generation settings
    },
});

export const remove = mutation({
    args: { id: v.id("image_edit_conversations") },
    handler: async (ctx, args) => {
        // Delete conversation and all related turns/outputs
        // Clean up storage
    },
});
```

### File: `src/convex/imageEditTurns.ts`

```typescript
// Queries
export const listByConversation = query({
    args: { conversationId: v.id("image_edit_conversations") },
    handler: async (ctx, args) => {
        // Get all turns for conversation
        // Include outputs with resolved URLs
        // Order by turnNumber asc
    },
});

export const get = query({
    args: { id: v.id("image_edit_turns") },
    handler: async (ctx, args) => {
        // Get single turn with outputs
    },
});

// Internal mutations (called from actions)
export const create = internalMutation({
    args: {
        conversationId: v.id("image_edit_conversations"),
        turnNumber: v.number(),
        userMessage: v.string(),
        referenceImageIds: v.array(v.id("_storage")),
        manualReferenceImageIds: v.optional(v.array(v.id("_storage"))),
        imageModels: v.array(v.string()),
        aspectRatio: v.string(),
        resolution: v.string(),
        pendingModels: v.array(v.string()),
        totalModels: v.number(),
    },
    handler: async (ctx, args) => {
        // Create turn record
        // Update conversation turnCount and status
    },
});

export const removeFromPending = internalMutation({
    args: {
        id: v.id("image_edit_turns"),
        model: v.string(),
    },
    handler: async (ctx, args) => {
        // Remove model from pendingModels
        // If empty, mark turn as completed
    },
});

export const markCompleted = internalMutation({
    args: { id: v.id("image_edit_turns") },
    handler: async (ctx, args) => {
        // Mark turn as completed
        // Update conversation status to "active"
    },
});

export const markFailed = internalMutation({
    args: {
        id: v.id("image_edit_turns"),
        error: v.string(),
    },
    handler: async (ctx, args) => {
        // Mark turn as failed with error
    },
});
```

### File: `src/convex/imageEditOutputs.ts`

```typescript
// Queries
export const listByTurn = query({
    args: { turnId: v.id("image_edit_turns") },
    handler: async (ctx, args) => {
        // Get all outputs for a turn with resolved URLs
    },
});

export const listByConversation = query({
    args: { conversationId: v.id("image_edit_conversations") },
    handler: async (ctx, args) => {
        // Get ALL outputs for conversation (for thumbnail strip)
        // Returns flat array with turn info
    },
});

// Internal mutations
export const create = internalMutation({
    args: {
        turnId: v.id("image_edit_turns"),
        conversationId: v.id("image_edit_conversations"),
        storageId: v.id("_storage"),
        model: v.string(),
        prompt: v.string(),
        width: v.number(),
        height: v.number(),
    },
    handler: async (ctx, args) => {
        // Create output record
    },
});
```

### File: `src/convex/ai/imageEdit.ts`

```typescript
/**
 * Start a new image editing conversation
 * Creates conversation + first turn, generates images
 */
export const startConversation = action({
    args: {
        sourceImageId: v.id("generated_images"),
        message: v.string(), // First edit instruction
        imageModels: v.array(v.string()),
        aspectRatio: v.string(),
        resolution: v.string(),
        manualReferenceImageIds: v.optional(v.array(v.id("_storage"))), // Additional refs
    },
    handler: async (ctx, args) => {
        // 1. Auth check
        // 2. Get source image + verify access
        // 3. Generate title from first message (truncate to ~50 chars)
        // 4. Create conversation record
        // 5. Get source image URL for references
        // 6. Create first turn with source image as reference
        // 7. Generate images in parallel (one per model)
        // 8. Store outputs progressively
        // 9. Return conversationId
    },
});

/**
 * Continue an existing conversation with a new turn
 */
export const continueConversation = action({
    args: {
        conversationId: v.id("image_edit_conversations"),
        message: v.string(),
        imageModels: v.optional(v.array(v.string())), // Override models
        manualReferenceImageIds: v.optional(v.array(v.id("_storage"))),
    },
    handler: async (ctx, args) => {
        // 1. Auth check
        // 2. Get conversation + verify access
        // 3. Get previous turn's outputs as references
        // 4. Collect reference URLs (previous turn outputs + manual refs)
        // 5. Create new turn record
        // 6. Generate images in parallel
        // 7. Store outputs progressively
        // 8. Update conversation turnCount
    },
});
```

### Helper: Reference Image Collection

```typescript
// src/convex/ai/imageEdit.ts

/**
 * Collect reference image URLs for a turn
 * - Auto-includes all images from previous turn
 * - Includes manual reference images
 * - Limits to reasonable count (e.g., 5 max)
 */
async function collectTurnReferences(
    ctx: ActionCtx,
    conversationId: Id<"image_edit_conversations">,
    turnNumber: number,
    manualReferenceIds?: Id<"_storage">[]
): Promise<{ urls: string[]; storageIds: Id<"_storage">[] }> {
    const urls: string[] = [];
    const storageIds: Id<"_storage">[] = [];
    
    // Get previous turn's outputs
    if (turnNumber > 1) {
        const prevTurn = await ctx.runQuery(api.imageEditTurns.getByNumber, {
            conversationId,
            turnNumber: turnNumber - 1,
        });
        if (prevTurn) {
            const outputs = await ctx.runQuery(api.imageEditOutputs.listByTurn, {
                turnId: prevTurn._id,
            });
            for (const output of outputs) {
                if (output.url) {
                    urls.push(output.url);
                    storageIds.push(output.storageId);
                }
            }
        }
    } else {
        // First turn - use source image
        const conv = await ctx.runQuery(api.imageEditConversations.get, {
            id: conversationId,
        });
        if (conv?.sourceImageUrl) {
            urls.push(conv.sourceImageUrl);
        }
    }
    
    // Add manual references
    if (manualReferenceIds) {
        for (const id of manualReferenceIds) {
            const url = await ctx.storage.getUrl(id);
            if (url) {
                urls.push(url);
                storageIds.push(id);
            }
        }
    }
    
    // Limit to 5 references
    return {
        urls: urls.slice(0, 5),
        storageIds: storageIds.slice(0, 5),
    };
}
```

---

## Phase 3: Frontend Components

### Component: `EditImageModal.svelte`

**Location:** `src/lib/components/studio/EditImageModal.svelte`

**Props:**
```typescript
interface Props {
    image: GeneratedImage; // The source image to edit
    open: boolean;
    onclose: () => void;
}
```

**State:**
```typescript
let message = $state(""); // Edit instruction
let selectedModels = $state<string[]>([]); // Defaults from original image model
let aspectRatio = $state<AspectRatio>("1:1");
let resolution = $state<Resolution>("standard");
let referenceImages = $state<Array<{ id: string; url: string; file: File }>>([]);
let isStarting = $state(false);
```

**UI Layout:**
```
+--------------------------------------------------+
|  Edit Image                              [X]      |
+--------------------------------------------------+
|                                                   |
|  +-------------+    Source Image                  |
|  |             |    Model: SeeDream v4.5          |
|  |   [IMAGE]   |    Dimensions: 1024x1024         |
|  |             |                                  |
|  +-------------+                                  |
|                                                   |
|  -------------------------------------------      |
|                                                   |
|  Describe your edit                               |
|  +-------------------------------------------+   |
|  | [Textarea]                            |Add|   |
|  |                                           |   |
|  +-------------------------------------------+   |
|                                                   |
|  [Reference thumbnails if any]                    |
|                                                   |
|  Model                                            |
|  [ImageModelSelector - multi-select]              |
|                                                   |
|  [Start Editing]                                  |
|                                                   |
+--------------------------------------------------+
```

**Behavior:**
1. On mount, pre-select the source image's model in ImageModelSelector
2. Pre-fill aspectRatio from source image
3. "Add" button opens file picker for additional references
4. "Start Editing" calls `api.ai.imageEdit.startConversation`
5. On success, navigate to `/posts/edit/[conversationId]`

### Page: `/posts/edit/[conversationId]/+page.svelte`

**Location:** `src/routes/posts/edit/[conversationId]/+page.svelte`

**URL:** `/posts/edit/{conversationId}`

**Subscriptions:**
```typescript
const conversationQuery = useQuery(
    api.imageEditConversations.get,
    () => ({ id: conversationId })
);

const turnsQuery = useQuery(
    api.imageEditTurns.listByConversation,
    () => ({ conversationId })
);

const allOutputsQuery = useQuery(
    api.imageEditOutputs.listByConversation,
    () => ({ conversationId })
);
```

**State:**
```typescript
let message = $state(""); // Current input
let selectedModels = $state<string[]>([]); // Can override per-turn
let showModelSelector = $state(false);
let referenceImages = $state<Array<{ id: string; url: string; file: File }>>([]);
let isSending = $state(false);
let selectedThumbnailIndex = $state<number | null>(null);
```

**UI Layout:**
```
+------------------------------------------------------------------+
| [<-]  Edit: "Make the background darker..."      Turn 3 of 3     |
+------------------------------------------------------------------+
|                                                                   |
| Thumbnail Strip (all images, scrollable)                          |
| +---------------------------------------------------------------+ |
| | [src] [t1] [t1] [t2] [t2] [t3] [t3] [skeleton] [skeleton]     | |
| +---------------------------------------------------------------+ |
|                                                                   |
+------------------------------------------------------------------+
|                                                                   |
|  Turn 1                                                           |
|  You: "Make the background a sunset gradient"                     |
|                                                                   |
|  +------------+  +------------+                                   |
|  |  [Image]   |  |  [Image]   |                                   |
|  | SeeDream   |  | Flux 2     |                                   |
|  +------------+  +------------+                                   |
|                                                                   |
|  -----------------------------------------------------------      |
|                                                                   |
|  Turn 2                                                           |
|  You: "Add some clouds"                                           |
|                                                                   |
|  +------------+  +------------+                                   |
|  |  [Image]   |  |  [Image]   |                                   |
|  | SeeDream   |  | Flux 2     |                                   |
|  +------------+  +------------+                                   |
|                                                                   |
|  (scroll area for conversation)                                   |
|                                                                   |
+------------------------------------------------------------------+
| [Model Selector Toggle] [References (2)]                          |
| +---------------------------------------------------------------+ |
| | Describe your next edit...                          [Send ->] | |
| +---------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

**Header:**
- Back button (`<-`) → navigates to previous page or `/posts/create`
- Title: Truncated conversation title (from first prompt)
- Turn count badge: "Turn X of Y"

**Thumbnail Strip:**
- Horizontal scrollable container
- First thumbnail: Source image (slightly different style, labeled "Source")
- Following thumbnails: All outputs grouped by turn
- Pending outputs show as skeletons
- Click thumbnail → scroll to that turn in conversation
- Currently generating thumbnails pulse/animate

**Conversation Area:**
- Scrollable container
- Each turn rendered as a "card":
  - User message in a bubble/card style
  - Grid of generated images (2 columns for 2 models, etc.)
  - Each image shows model name badge
  - Loading skeletons for pending images
  - Click image to view full size (optional lightbox)

**Input Area:**
- Fixed at bottom
- Model selector toggle (collapsed by default, shows current models as badges)
- Reference images row (shows added refs as small thumbnails)
- Textarea for message
- Send button (disabled while generating)

### Component: `TurnCard.svelte`

**Location:** `src/lib/components/studio/TurnCard.svelte`

**Props:**
```typescript
interface Props {
    turn: ImageEditTurn;
    outputs: ImageEditOutput[];
    turnNumber: number;
    isGenerating: boolean;
}
```

**UI:**
```
+--------------------------------------------------+
| Turn {turnNumber}                                 |
+--------------------------------------------------+
| You: "{turn.userMessage}"                        |
|                                                   |
| +------------+  +------------+  +------------+   |
| |            |  |            |  | [skeleton] |   |
| |  [Image]   |  |  [Image]   |  |            |   |
| |  Model A   |  |  Model B   |  |  Model C   |   |
| +------------+  +------------+  +------------+   |
+--------------------------------------------------+
```

### Component: `ConversationThumbnailStrip.svelte`

**Location:** `src/lib/components/studio/ConversationThumbnailStrip.svelte`

**Props:**
```typescript
interface Props {
    sourceImage: { url: string; model: string };
    outputs: ImageEditOutput[]; // All outputs flat
    pendingModels: string[]; // Currently generating
    onselect: (turnNumber: number) => void;
}
```

**UI:**
- Horizontal scroll container with flex
- Source image thumbnail with "Source" label
- Output thumbnails grouped visually by turn (subtle dividers)
- Skeleton thumbnails for pending
- Highlight selected/active thumbnail

---

## Phase 4: Data Flow

### Starting a Conversation

```
User clicks "Edit" on image
       ↓
EditImageModal opens
       ↓
User fills: message, models, refs
       ↓
User clicks "Start Editing"
       ↓
Frontend calls: api.ai.imageEdit.startConversation
       ↓
Action:
  1. Creates image_edit_conversations record
  2. Creates image_edit_turns record (turn 1)
  3. Spawns parallel image generation for each model
  4. Each completion: saves to image_edit_outputs, removes from pending
  5. Returns conversationId
       ↓
Frontend navigates to /posts/edit/[conversationId]
       ↓
Subscriptions activate:
  - conversationQuery → gets conversation data
  - turnsQuery → gets turns with outputs
  - allOutputsQuery → gets all images for thumbnail strip
       ↓
UI renders progressively as images complete
```

### Continuing a Conversation

```
User on conversation page
       ↓
User types message, clicks Send
       ↓
Frontend calls: api.ai.imageEdit.continueConversation
       ↓
Action:
  1. Gets previous turn's outputs as references (auto)
  2. Adds any manual reference images
  3. Creates new image_edit_turns record
  4. Spawns parallel image generation
  5. Progressive updates to image_edit_outputs
       ↓
Subscriptions update UI automatically:
  - New turn appears in conversation
  - Skeletons show while generating
  - Images appear as they complete
  - Thumbnail strip updates progressively
```

### Reference Image Flow

```
Turn N generates images:
  - Image A (Model 1)
  - Image B (Model 2)
       ↓
Turn N+1 starts:
  - Auto-collects: Image A, Image B URLs
  - User adds: Manual ref C
  - referenceImageUrls = [A, B, C]
       ↓
Image generation receives references:
  - Models see previous outputs + user refs
  - Can maintain consistency across turns
```

---

## Phase 5: Implementation Order

### Stage 1: Backend Foundation (Day 1)
1. Add new tables to schema.ts
2. Implement `imageEditConversations.ts` (CRUD)
3. Implement `imageEditTurns.ts` (CRUD + internal mutations)
4. Implement `imageEditOutputs.ts` (CRUD)
5. Test with Convex dashboard

### Stage 2: Backend Actions (Day 2)
1. Implement `startConversation` action
2. Implement `continueConversation` action
3. Test progressive loading via dashboard
4. Verify reference image passing works

### Stage 3: Frontend Modal (Day 3)
1. Create `EditImageModal.svelte`
2. Add "Edit" button to image thumbnails (in create page)
3. Wire up modal → action → navigation
4. Test full flow: click Edit → modal → start conversation

### Stage 4: Frontend Conversation Page (Day 4-5)
1. Create route `/posts/edit/[conversationId]/+page.svelte`
2. Implement header with back nav + title + turn count
3. Implement `ConversationThumbnailStrip.svelte`
4. Implement conversation area with turn cards
5. Implement input area with model selector + refs + send

### Stage 5: Polish (Day 6)
1. Add loading states and error handling
2. Implement image lightbox/full view
3. Add conversation list/history page (optional)
4. Mobile responsiveness
5. Accessibility improvements

---

## File Structure Summary

```
src/
├── convex/
│   ├── schema.ts                    # +3 new tables
│   ├── imageEditConversations.ts    # NEW - conversation CRUD
│   ├── imageEditTurns.ts            # NEW - turn CRUD
│   ├── imageEditOutputs.ts          # NEW - output CRUD
│   └── ai/
│       └── imageEdit.ts             # NEW - start/continue actions
│
├── lib/components/studio/
│   ├── EditImageModal.svelte              # NEW - modal to start edit
│   ├── TurnCard.svelte                    # NEW - single turn display
│   └── ConversationThumbnailStrip.svelte  # NEW - top thumbnail strip
│
└── routes/posts/
    ├── create/+page.svelte          # MODIFY - add Edit button to images
    └── edit/
        └── [conversationId]/
            └── +page.svelte         # NEW - conversation page
```

---

## API Summary

### Queries
| Query | Args | Returns |
|-------|------|---------|
| `imageEditConversations.get` | `{ id }` | Conversation with source image URL |
| `imageEditConversations.listByUser` | `{}` | All user conversations |
| `imageEditTurns.listByConversation` | `{ conversationId }` | All turns with outputs |
| `imageEditOutputs.listByConversation` | `{ conversationId }` | Flat list of all outputs |

### Mutations
| Mutation | Args | Returns |
|----------|------|---------|
| `imageEditConversations.create` | `{ sourceImageId, title, imageModels, aspectRatio, resolution }` | conversationId |
| `imageEditConversations.updateSettings` | `{ id, imageModels?, aspectRatio?, resolution? }` | void |
| `imageEditConversations.remove` | `{ id }` | void |

### Actions
| Action | Args | Returns |
|--------|------|---------|
| `ai.imageEdit.startConversation` | `{ sourceImageId, message, imageModels, aspectRatio, resolution, manualReferenceImageIds? }` | `{ conversationId }` |
| `ai.imageEdit.continueConversation` | `{ conversationId, message, imageModels?, manualReferenceImageIds? }` | `{ turnId }` |

---

## Key Implementation Notes

### Progressive Loading Pattern
Copy the pattern from `posts/create/+page.svelte`:
- Use `pendingModels` array on turns
- Subscribe to turns/outputs queries
- Render skeletons for pending models
- Images appear as they complete via subscription

### Reference Image Limit
- Limit to 5 reference images per turn
- Previous turn's outputs take priority
- Then manual refs fill remaining slots
- Warn user if they try to add too many

### Title Generation
- Auto-generate from first message
- Truncate to ~50 characters
- Allow manual edit later (optional)

### Error Handling
- If all images fail in a turn, mark turn as failed
- Show error message in UI
- Allow retry (re-send same message)

### Cleanup
- When deleting conversation, delete all turns, outputs, and storage files
- Use transaction or batch operations where possible
