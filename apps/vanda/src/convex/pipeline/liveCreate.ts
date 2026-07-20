import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as LanguageModel from "effect/unstable/ai/LanguageModel";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { CreateStore, type GeneratedImage, ImageGen } from "./create";
import { Embeddings, embeddingsLive } from "./embeddings";
import { languageModelLayer, PIPELINE_MODELS } from "./liveModel";
import { buildBundle, Retrieval } from "./retrieval";

/**
 * A deterministic on-brand placeholder slide per prompt (brand magenta + the
 * prompt as a caption). The real AI generator — storing a hosted image to Convex
 * `_storage` — swaps in behind the `ImageGen` port; the durable workflow already
 * checkpoints each call as its own retried step, so that step is the only thing
 * that changes when generation gets slow and flaky.
 *
 * NOTE: the `data:` URL is for gallery preview only. Instagram's media-container
 * API needs a publicly fetchable HTTPS URL, so the real generator must produce a
 * hosted URL (or `storageId`) before the publish path runs against live IG.
 */
const placeholderImage = (prompt: string): GeneratedImage => {
  // Slice by code points so an emoji on the 48th boundary can't leave a lone
  // surrogate that makes `encodeURIComponent` throw (a defect, not ImageGenFailed).
  const label = [...prompt].slice(0, 48).join("").replace(/[<>&]/g, " ");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">` +
    `<rect width="100%" height="100%" fill="#c4277f"/>` +
    `<text x="50%" y="92%" fill="#ffffff" font-family="sans-serif" font-size="34" ` +
    `text-anchor="middle">${label}</text></svg>`;
  return {
    prompt,
    width: 1024,
    height: 1024,
    externalUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  };
};

export const imageGenLive: Layer.Layer<ImageGen> = Layer.succeed(ImageGen, {
  generate: (prompt) => Effect.succeed(placeholderImage(prompt)),
});

/**
 * Hybrid RAG: semantic search over persisted account-scoped memory, with lexical
 * fallback while the vector index is empty or updating. Confirmed canon is always
 * returned separately and never depends on retrieval rank.
 */
export const retrievalLive = (ctx: ActionCtx, apiKey: string): Layer.Layer<Retrieval> =>
  Layer.effect(
    Retrieval,
    Effect.map(Embeddings, (embeddings) => ({
      retrieve: (accountId: string, query: string) => {
        const id = accountId as Id<"accounts">;
        const loadCorpus = Effect.tryPromise(() =>
          ctx.runQuery(internal.create.brandCorpus, { accountId: id }),
        );
        const lexical = Effect.map(loadCorpus, (corpus) =>
          buildBundle(
            query,
            corpus.statements,
            corpus.themeSummary,
            corpus.critical,
            corpus.referenceImageUrls,
          ),
        );
        const semantic = Effect.gen(function* () {
          const corpus = yield* loadCorpus;
          const [vector] = yield* embeddings.embed([query]);
          const matches = yield* Effect.tryPromise(() =>
            ctx.vectorSearch("knowledgeChunks", "by_embedding", {
              vector: [...vector!],
              limit: 8,
              filter: (filter) => filter.eq("accountId", id),
            }),
          );
          const chunks = yield* Effect.tryPromise(() =>
            ctx.runQuery(internal.knowledge.byIds, { ids: matches.map((match) => match._id) }),
          );
          const byId = new Map(chunks.map((chunk) => [chunk._id, chunk] as const));
          const vectorSnippets = matches.flatMap((match) => {
            const chunk = byId.get(match._id);
            return chunk === undefined || chunk.kind === "canon" ? [] : [chunk.text];
          });
          const fallback = buildBundle(
            query,
            corpus.statements,
            corpus.themeSummary,
            corpus.critical,
            corpus.referenceImageUrls,
          );
          return {
            ...fallback,
            snippets: [...new Set([...vectorSnippets, ...fallback.snippets])].slice(0, 8),
          };
        });
        return semantic.pipe(
          Effect.catch((error) =>
            Effect.logWarning(`retrieval semântico indisponível: ${String(error)}`).pipe(
              Effect.andThen(lexical),
            ),
          ),
        );
      },
    })),
  ).pipe(Layer.provide(embeddingsLive(apiKey)));

/** Persist the composed carousel + promote the suggestion via a Convex mutation. */
export const createStoreLive = (ctx: ActionCtx): Layer.Layer<CreateStore> =>
  Layer.succeed(CreateStore, {
    compose: (input) =>
      Effect.tryPromise(() =>
        ctx.runMutation(internal.create.composePost, {
          accountId: input.accountId as Id<"accounts">,
          suggestionId: input.suggestionId as Id<"suggestions">,
          type: input.type,
          caption: input.caption,
          images: input.images.map((image) => ({
            prompt: image.prompt,
            width: image.width,
            height: image.height,
            ...(image.storageId !== undefined ? { storageId: image.storageId } : {}),
            ...(image.externalUrl !== undefined ? { externalUrl: image.externalUrl } : {}),
          })),
        }),
      ),
  });

/** The production layer for the create stage running inside a Convex action. */
export const createLayer = (
  ctx: ActionCtx,
  apiKey: string,
): Layer.Layer<Retrieval | ImageGen | CreateStore | LanguageModel.LanguageModel> =>
  Layer.mergeAll(
    retrievalLive(ctx, apiKey),
    imageGenLive,
    createStoreLive(ctx),
    languageModelLayer(apiKey, PIPELINE_MODELS.create),
  );
