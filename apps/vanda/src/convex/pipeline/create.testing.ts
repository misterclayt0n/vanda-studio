import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as LanguageModel from "effect/unstable/ai/LanguageModel";
import {
  type Composition,
  type ComposeInput,
  type ComposedPost,
  CreateStore,
  type GeneratedImage,
  ImageGen,
  ImageGenFailed,
} from "./create";
import { type ContextBundle, Retrieval } from "./retrieval";
import { makeStubLanguageModel } from "./testLanguageModel";

/** Retrieval that always returns a fixed bundle — no corpus, no ranking. */
export const makeStubRetrieval = (bundle: ContextBundle): Layer.Layer<Retrieval> =>
  Layer.succeed(Retrieval, { retrieve: () => Effect.succeed(bundle) });

/** LanguageModel that returns a fixed composition for the caption call. */
export const makeStubCaption = (
  composition: Composition,
): Layer.Layer<LanguageModel.LanguageModel> => makeStubLanguageModel(() => composition);

/**
 * Mock image generator: records every prompt it sees and returns a placeholder
 * image, optionally failing on one prompt to exercise the error/retry path.
 */
export interface MockImageGen {
  readonly layer: Layer.Layer<ImageGen>;
  /** Prompts seen, in arrival order (concurrent, so assert membership not order). */
  readonly prompts: ReadonlyArray<string>;
}

export const makeMockImageGen = (options: { readonly failOn?: string } = {}): MockImageGen => {
  const prompts: Array<string> = [];
  const layer = Layer.succeed(ImageGen, {
    generate: (prompt: string) =>
      Effect.suspend(() => {
        prompts.push(prompt);
        if (options.failOn !== undefined && prompt === options.failOn)
          return Effect.fail(new ImageGenFailed({ prompt, reason: "mock failure" }));
        return Effect.succeed<GeneratedImage>({
          prompt,
          width: 1024,
          height: 1024,
          externalUrl: `mock://image/${encodeURIComponent(prompt)}`,
        });
      }),
  });
  return { layer, prompts };
};

/**
 * In-memory CreateStore: records each compose input and returns a ComposedPost
 * whose imageIds preserve carousel order, so a test can assert the composition
 * without a database.
 */
export interface MockCreateStore {
  readonly layer: Layer.Layer<CreateStore>;
  readonly composed: ReadonlyArray<ComposeInput>;
}

export const makeInMemoryCreateStore = (): MockCreateStore => {
  const composed: Array<ComposeInput> = [];
  let seq = 0;
  const layer = Layer.succeed(CreateStore, {
    compose: (input: ComposeInput) =>
      Effect.sync(() => {
        composed.push(input);
        const postId = `post_${seq++}`;
        const result: ComposedPost = {
          postId,
          imageIds: input.images.map((_, index) => `${postId}_img_${index}`),
          caption: input.caption,
          type: input.type,
        };
        return result;
      }),
  });
  return { layer, composed };
};
