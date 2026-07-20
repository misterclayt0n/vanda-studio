import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as LanguageModel from "effect/unstable/ai/LanguageModel";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { CreateStore, type GeneratedImage, ImageGen } from "./create";
import { languageModelLayer } from "./liveModel";
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
 * RAG retrieval over the account's brand knowledge: load the belief corpus + the
 * theme "voice" from Convex and rank it lexically against the query. A vector
 * index (embeddings) is the documented scale path — swap this layer and nothing
 * in `create` changes.
 */
export const retrievalLive = (ctx: ActionCtx): Layer.Layer<Retrieval> =>
  Layer.succeed(Retrieval, {
    retrieve: (accountId, query) =>
      Effect.map(
        Effect.tryPromise(() =>
          ctx.runQuery(internal.create.brandCorpus, { accountId: accountId as Id<"accounts"> }),
        ),
        (corpus) => buildBundle(query, corpus.statements, corpus.themeSummary, corpus.critical),
      ),
  });

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
    retrievalLive(ctx),
    imageGenLive,
    createStoreLive(ctx),
    languageModelLayer(apiKey),
  );
