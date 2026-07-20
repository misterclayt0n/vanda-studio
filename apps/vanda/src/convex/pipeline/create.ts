import type * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import { PostType } from "./memory";
import { type ContextBundle, Retrieval } from "./retrieval";

/** An approved suggestion resolved to what create needs to compose a post. */
export interface CreatableSuggestion {
  readonly suggestionId: string;
  readonly accountId: string;
  readonly title: string;
  readonly themeName: string;
  /** Format hint from plan; create decides the final type (defaults to feed). */
  readonly format?: typeof PostType.Type | undefined;
  /** The EXACT belief statements this suggestion is grounded in (its provenance). */
  readonly beliefStatements: ReadonlyArray<string>;
}

/** The model's composition: the caption plus one image prompt per carousel slide. */
export const Composition = Schema.Struct({
  caption: Schema.String,
  imagePrompts: Schema.Array(Schema.String),
});
export type Composition = typeof Composition.Type;

/** One generated image, ready to persist as an atomic media unit. */
export interface GeneratedImage {
  readonly prompt: string;
  readonly width: number;
  readonly height: number;
  readonly storageId?: string;
  readonly externalUrl?: string;
}

/** A composed post: the carousel of persisted image units + caption + type. */
export interface ComposedPost {
  readonly postId: string;
  readonly imageIds: ReadonlyArray<string>;
  readonly caption: string;
  readonly type: typeof PostType.Type;
}

/** Image generation failed for a prompt — typed so the workflow step can retry it. */
export class ImageGenFailed extends Data.TaggedError("ImageGenFailed")<{
  readonly prompt: string;
  readonly reason: string;
}> {}

/**
 * Image generator port. The live layer is a placeholder until the AI image
 * provider lands (the slow/flaky step the durable workflow checkpoints per
 * image); tests provide a mock that records prompts and can fail on demand.
 */
export interface ImageGenShape {
  readonly generate: (prompt: string) => Effect.Effect<GeneratedImage, ImageGenFailed>;
}

export class ImageGen extends Context.Service<ImageGen, ImageGenShape>()(
  "@vanda/pipeline/ImageGen",
) {}

/** What compose needs to persist a post from generated media. */
export interface ComposeInput {
  readonly accountId: string;
  readonly suggestionId: string;
  readonly type: typeof PostType.Type;
  readonly caption: string;
  readonly images: ReadonlyArray<GeneratedImage>;
}

/**
 * Persistence boundary for create: write the image units + the composed post and
 * promote the suggestion (approved → creating) in one transaction. Writes are
 * typed fallible, matching the rest of the pipeline.
 */
export interface CreateStoreShape {
  readonly compose: (input: ComposeInput) => Effect.Effect<ComposedPost, Cause.UnknownError>;
}

export class CreateStore extends Context.Service<CreateStore, CreateStoreShape>()(
  "@vanda/pipeline/CreateStore",
) {}

/** Instagram carousel cap; create proposes at most this many image units. */
export const MAX_IMAGES = 10;
/** Carousel fan-out limit, shared by `createPost` (in-process) and the workflow
 * (workpool `maxParallelism`) so one constant bounds image generation. */
export const IMAGE_CONCURRENCY = 4;

/** Create decides the final format; plan's hint wins, else a feed post. */
export const resolveType = (suggestion: CreatableSuggestion): typeof PostType.Type =>
  suggestion.format ?? "feed";

const queryOf = (suggestion: CreatableSuggestion): string =>
  `${suggestion.title} — ${suggestion.themeName}`;

const captionPrompt = (suggestion: CreatableSuggestion, bundle: ContextBundle): string => {
  const critical =
    bundle.critical.length === 0
      ? "(não informado)"
      : bundle.critical.map((statement) => `- ${statement}`).join("\n");
  const cited =
    suggestion.beliefStatements.length === 0
      ? "(none)"
      : suggestion.beliefStatements.map((statement) => `- ${statement}`).join("\n");
  const context =
    bundle.snippets.length === 0 ? "(none)" : bundle.snippets.map((s) => `- ${s}`).join("\n");
  return (
    `Você é a redatora de redes sociais de uma marca. Crie o ${resolveType(suggestion)} ` +
    `para Instagram a partir da ideia abaixo: uma legenda em português do Brasil, alinhada ` +
    `à marca, com chamada para ação natural e sem excesso de hashtags, além de um prompt ` +
    `visual concreto para cada slide do carrossel (1–${MAX_IMAGES}). Fundamente tudo nas ` +
    `crenças e no contexto confirmado da marca; não invente fatos.\n\n` +
    `Contexto confirmado obrigatório:\n${critical}\n\n` +
    `Ideia: ${suggestion.title}\nTema: ${suggestion.themeName}` +
    `${bundle.themeSummary ? ` — ${bundle.themeSummary}` : ""}\n\n` +
    `Crenças que fundamentam a ideia:\n${cited}\n\nOutro contexto relevante da marca:\n${context}`
  );
};

// --- Stage slices (shared by the durable workflow and `createPost`) --------

/** Retrieve (RAG) the brand context most relevant to the suggestion. */
export const retrieveContext = (
  suggestion: CreatableSuggestion,
): Effect.Effect<ContextBundle, Cause.UnknownError, Retrieval> =>
  Effect.flatMap(Retrieval, (retrieval) =>
    retrieval.retrieve(suggestion.accountId, queryOf(suggestion)),
  );

/** Ask the model for the caption + image prompts, clamped to a valid carousel. */
export const composeCaption = (suggestion: CreatableSuggestion, bundle: ContextBundle) =>
  Effect.map(
    LanguageModel.generateObject({
      prompt: captionPrompt(suggestion, bundle),
      schema: Composition,
    }),
    (response) => {
      const clamped = response.value.imagePrompts.slice(0, MAX_IMAGES);
      // The model must give at least one slide; fall back to the idea title.
      return {
        caption: response.value.caption,
        imagePrompts: clamped.length > 0 ? clamped : [suggestion.title],
      };
    },
  );

/** Generate every carousel image (the durable workflow runs these as retried steps). */
export const generateImages = (
  prompts: ReadonlyArray<string>,
): Effect.Effect<ReadonlyArray<GeneratedImage>, ImageGenFailed, ImageGen> =>
  Effect.flatMap(ImageGen, (imageGen) =>
    Effect.forEach(prompts, (prompt) => imageGen.generate(prompt), {
      concurrency: IMAGE_CONCURRENCY,
    }),
  );

/**
 * The create stage: compose an approved suggestion into a post. Retrieve brand
 * context (RAG), have the model write the caption + image prompts, generate the
 * images, then persist the composed carousel. This is the flow as one Effect —
 * tested under stub layers; the durable workflow runs the same slices as
 * checkpointed steps so a failed image-gen never redoes the caption.
 */
export const createPost = Effect.fn("pipeline.createPost")(function* (
  suggestion: CreatableSuggestion,
) {
  const bundle = yield* retrieveContext(suggestion);
  const composition = yield* composeCaption(suggestion, bundle);
  const images = yield* generateImages(composition.imagePrompts);
  const store = yield* CreateStore;
  return yield* store.compose({
    accountId: suggestion.accountId,
    suggestionId: suggestion.suggestionId,
    type: resolveType(suggestion),
    caption: composition.caption,
    images,
  });
});
