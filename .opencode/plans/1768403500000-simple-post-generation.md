# Chat-Based Post Generation Pipeline

## Overview

Replace the form-based post generation with a **chat-based experience** where users can iteratively refine their posts through conversation. Each generated post has a full conversation history with snapshots at each turn.

**Flow Example:**
```
User: "Create a post about our new coffee blend"
AI: [generates caption + image] "Aqui está! Criei uma legenda focada em..."
User: "Make it more casual"
AI: [regenerates caption] "Pronto! Deixei mais descontraído..."
User: "The image should have a white background"  
AI: [regenerates image] "Regenerei a imagem com fundo branco..."
```

## Data Model

### New Table: `chat_messages`

```typescript
chat_messages: defineTable({
  generatedPostId: v.id("generated_posts"),
  role: v.string(),  // "user" | "assistant"
  content: v.string(),  // The message text
  
  // Snapshot of state AFTER this message
  snapshot: v.optional(v.object({
    caption: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    imagePrompt: v.optional(v.string()),
  })),
  
  // Attachments for this message (user messages only)
  attachments: v.optional(v.object({
    imageUrls: v.optional(v.array(v.string())),  // Reference images
    instagramPostUrl: v.optional(v.string()),    // Fetched IG post
    referenceText: v.optional(v.string()),       // Text context
  })),
  
  // Metadata
  model: v.optional(v.string()),  // Which model generated this (assistant only)
  creditsUsed: v.optional(v.number()),  // Credits consumed
  createdAt: v.number(),
}).index("by_generated_post_id", ["generatedPostId"])
  .index("by_created_at", ["generatedPostId", "createdAt"]),
```

### Modified: `generated_posts`

Keep as-is for the "current state" of the post, but the conversation lives in `chat_messages`.

```typescript
generated_posts: defineTable({
  projectId: v.id("projects"),
  
  // Current state (updated after each AI turn)
  caption: v.string(),
  imageStorageId: v.optional(v.id("_storage")),
  imagePrompt: v.optional(v.string()),
  
  // Metadata
  model: v.optional(v.string()),
  imageModel: v.optional(v.string()),
  status: v.string(),  // "in_progress" | "completed"
  
  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
}),
```

### Deprecate: `generation_history`

The `generation_history` table becomes redundant since `chat_messages` with snapshots serves the same purpose but better. We can migrate or keep for backwards compatibility.

## API Design

### 1. Start Conversation / Initial Generation

```typescript
// POST /api/posts/generate (action)
export const generate = action({
  args: {
    projectId: v.id("projects"),
    message: v.string(),  // "Create a post about our new coffee"
    attachments: v.optional(v.object({
      imageUrls: v.optional(v.array(v.string())),
      instagramPostUrl: v.optional(v.string()),
      referenceText: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    // 1. Create generated_post record (status: "in_progress")
    // 2. Save user message to chat_messages
    // 3. Generate caption + image
    // 4. Save assistant message with snapshot
    // 5. Update generated_post with current state
    // 6. Return { generatedPostId, caption, imageUrl }
  },
});
```

### 2. Continue Conversation / Refine

User explicitly specifies what to regenerate via separate actions:

```typescript
// Regenerate caption only
export const regenerateCaption = action({
  args: {
    generatedPostId: v.id("generated_posts"),
    message: v.string(),  // "Make it more casual"
  },
  handler: async (ctx, args) => {
    // 1. Load conversation history
    // 2. Save user message
    // 3. Generate new caption with full context
    // 4. Save assistant message with snapshot (same image, new caption)
    // 5. Update generated_post
  },
});

// Regenerate image only
export const regenerateImage = action({
  args: {
    generatedPostId: v.id("generated_posts"),
    message: v.string(),  // "White background please"
    attachments: v.optional(v.object({
      imageUrls: v.optional(v.array(v.string())),
    })),
  },
  handler: async (ctx, args) => {
    // 1. Load conversation history
    // 2. Save user message
    // 3. Generate new image based on current caption + user instructions
    // 4. Save assistant message with snapshot (same caption, new image)
    // 5. Update generated_post
  },
});

// Regenerate both (optional, for convenience)
export const regenerateBoth = action({
  args: {
    generatedPostId: v.id("generated_posts"),
    message: v.string(),
    attachments: v.optional(v.object({...})),
  },
  handler: async (ctx, args) => {
    // Same as initial generation but with conversation context
  },
});
```

### 3. Load Conversation

```typescript
// GET /api/posts/:id/messages (query)
export const getMessages = query({
  args: { generatedPostId: v.id("generated_posts") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chat_messages")
      .withIndex("by_generated_post_id", q => q.eq("generatedPostId", args.generatedPostId))
      .order("asc")
      .collect();
  },
});
```

### 4. Rollback to Previous State

```typescript
// POST /api/posts/:id/rollback (mutation)
export const rollback = mutation({
  args: {
    generatedPostId: v.id("generated_posts"),
    messageId: v.id("chat_messages"),  // Rollback to state after this message
  },
  handler: async (ctx, args) => {
    // 1. Get the message's snapshot
    // 2. Update generated_post with that snapshot's state
    // 3. Add system message: "Restored to previous version"
  },
});
```

## Agent Architecture

### Caption Agent

Simple, stateless function that generates captions.

```typescript
// src/convex/ai/agents/caption.ts

const SYSTEM_PROMPT = `Voce e um assistente especialista em criar legendas para Instagram em portugues brasileiro.

Sua tarefa e ajudar o usuario a criar e refinar legendas. Voce pode:
- Criar legendas do zero baseado em instrucoes
- Modificar legendas existentes baseado em feedback
- Ajustar tom, tamanho, hashtags conforme solicitado

Sempre responda em portugues brasileiro.
Seja conciso nas explicacoes.

Responda em JSON:
{
  "caption": "a legenda completa",
  "explanation": "breve explicacao do que foi feito"
}`;

export interface CaptionInput {
  conversationHistory: ChatMessage[];  // Full context
  currentCaption?: string;  // Current caption if refining
}

export async function generateCaption(input: CaptionInput): Promise<{
  caption: string;
  explanation: string;
}>;
```

### Image Agent

Stateless function that generates images.

```typescript
// src/convex/ai/agents/image.ts

const SYSTEM_PROMPT = `Generate a photorealistic Instagram image.
Must look like a real photograph, not digital art.
If reference images provided, preserve exact product appearance.
NO text in image unless explicitly requested.`;

export interface ImageInput {
  caption: string;
  instructions?: string;  // From conversation: "white background"
  referenceImageUrls?: string[];
}

export async function generateImage(input: ImageInput): Promise<{
  imageBase64: string;
  mimeType: string;
  prompt: string;
}>;
```

### No Orchestrator Needed

Since the user explicitly chooses what to regenerate (caption, image, or both), we don't need an orchestrator to analyze intent. The actions directly call the appropriate agent.

## File Structure

```
src/convex/ai/
├── agents/
│   ├── caption.ts        # Caption generation
│   ├── image.ts          # Image generation  
│   └── index.ts          # Exports
├── chat.ts               # Chat/conversation actions (generate, regenerateCaption, regenerateImage, etc.)
├── llm/                  # Keep as-is (Effect + Vercel AI SDK)
│   ├── index.ts
│   ├── errors.ts
│   ├── config.ts
│   ├── models.ts
│   ├── runtime.ts
│   └── services/
│       ├── TextGeneration.ts
│       └── ImageGeneration.ts
└── [DELETE] enhancedPostGeneration.ts
└── [DELETE] prompts.ts
└── [DELETE] regenerate.ts  # Replaced by chat.ts
```

## UI Flow

### Chat Interface

```
+------------------------------------------+
|  [Back to Posts]           Project Name  |
+------------------------------------------+
|                                          |
|  +------------------------------------+  |
|  | [Image Preview]      [Regen Image] |  |
|  |                                    |  |
|  | Caption text here with emojis...  |  |
|  | #hashtags #here     [Regen Caption]|  |
|  +------------------------------------+  |
|                                          |
|  --- Chat History ---                    |
|                                          |
|  [User] Create a post about coffee      |
|  [AI] Criei uma legenda focada em...    |
|                                          |
|  [User] More casual please               |  <-- Click to rollback
|  [AI] Pronto! Deixei mais descontraído  |
|                                          |
|  [User] White background on image        |
|  [AI] Regenerei com fundo branco         |
|                                          |
+------------------------------------------+
|  [Attach] [Instagram] [ Type message... ]|
|                        [Caption] [Image] |
+------------------------------------------+
```

### Actions
- **Click on past message** → Show "Restore this version?" confirmation
- **Attach button** → Upload images
- **Instagram button** → Input Instagram URL to fetch post
- **[Caption] button** → Regenerate caption with the message as instructions
- **[Image] button** → Regenerate image with the message as instructions
- **Regen Caption/Image buttons** → Quick regenerate with default "Regenerate" message

## Schema Changes

```typescript
// Add to schema.ts

chat_messages: defineTable({
  generatedPostId: v.id("generated_posts"),
  role: v.string(),  // "user" | "assistant" | "system"
  content: v.string(),
  
  // State snapshot after this message
  snapshot: v.optional(v.object({
    caption: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    imagePrompt: v.optional(v.string()),
  })),
  
  // User message attachments
  attachments: v.optional(v.object({
    imageUrls: v.optional(v.array(v.string())),
    instagramPostUrl: v.optional(v.string()),
    referenceText: v.optional(v.string()),
  })),
  
  // Generation metadata (assistant messages)
  model: v.optional(v.string()),
  imageModel: v.optional(v.string()),
  creditsUsed: v.optional(v.number()),
  
  createdAt: v.number(),
}).index("by_generated_post_id", ["generatedPostId"])
  .index("by_created_at", ["generatedPostId", "createdAt"]),
```

## Implementation Order

### Phase 1: Backend Foundation
1. Add `chat_messages` table to schema
2. Create `src/convex/ai/agents/caption.ts`
3. Create `src/convex/ai/agents/image.ts`
4. Create `src/convex/ai/agents/index.ts`
5. Create `src/convex/ai/chat.ts` with actions:
   - `generate` - Initial generation (creates post + first messages)
   - `regenerateCaption` - Regenerate caption only
   - `regenerateImage` - Regenerate image only
   - `getMessages` - Load conversation history
   - `rollback` - Restore previous state from snapshot

### Phase 2: Instagram Fetching
7. Add `fetchInstagramPost` action to `src/convex/instagram.ts`

### Phase 3: Cleanup
8. Delete `src/convex/ai/enhancedPostGeneration.ts`
9. Delete `src/convex/ai/prompts.ts`
10. Delete `src/convex/ai/regenerate.ts`

### Phase 4: UI (Separate Task)
11. Build chat-based UI for post creation

## Verification

1. `bun run check` - No TypeScript errors
2. Test initial generation creates post + first messages
3. Test refinement creates new messages + updates state
4. Test full conversation context is sent to AI
5. Test rollback restores previous state
6. Test Instagram URL fetching
7. Test attachments flow through correctly

## Credits/Billing

- Initial generation: 2 credits (caption + image)
- Caption-only refinement: 1 credit
- Image-only refinement: 1 credit
- Rollback: 0 credits (no generation)

## Future Enhancements

- **Streaming**: Stream caption as it generates
- **Branching**: Create alternative versions without losing history
- **Templates**: Save successful conversations as templates
- **Suggested refinements**: AI suggests what to improve
