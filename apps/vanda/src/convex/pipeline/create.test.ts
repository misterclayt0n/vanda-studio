import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { describe, expect } from "vitest";
import { type Composition, type CreatableSuggestion, createPost, resolveType } from "./create";
import {
  makeInMemoryCreateStore,
  makeMockImageGen,
  makeStubCaption,
  makeStubRetrieval,
} from "./create.testing";
import { buildBundle, rankByRelevance, relevanceScore, tokenize } from "./retrieval";

describe("retrieval (RAG ranking)", () => {
  it.effect("tokenize drops short and stop words", () =>
    Effect.sync(() => {
      expect(tokenize("The golden retriever and our dog")).toEqual(["golden", "retriever", "dog"]);
    }),
  );

  it.effect("relevanceScore is the fraction of query terms present", () =>
    Effect.sync(() => {
      expect(relevanceScore("golden retriever", "our golden retriever naps")).toBe(1);
      expect(relevanceScore("golden retriever", "winter latte combo")).toBe(0);
      expect(relevanceScore("golden winter", "golden hour light")).toBe(0.5);
      expect(relevanceScore("", "anything")).toBe(0);
    }),
  );

  it.effect("rankByRelevance orders by score, keeps top-k, drops non-matches", () =>
    Effect.sync(() => {
      const ranked = rankByRelevance(
        "dog cafe",
        ["the dog visits the cafe", "a dog naps", "unrelated winter combo"],
        2,
      );
      expect(ranked).toEqual(["the dog visits the cafe", "a dog naps"]);
    }),
  );

  it.effect("buildBundle keeps the theme summary and the relevant snippets", () =>
    Effect.sync(() => {
      const bundle = buildBundle("dog", ["a happy dog", "winter latte"], "Pets");
      expect(bundle.snippets).toEqual(["a happy dog"]);
      expect(bundle.themeSummary).toBe("Pets");
      expect(buildBundle("dog", [], "Pets").snippets).toEqual([]);
    }),
  );
});

describe("resolveType", () => {
  it.effect("uses the format hint, else defaults to feed", () =>
    Effect.sync(() => {
      const base: CreatableSuggestion = {
        suggestionId: "s1",
        accountId: "acct_1",
        title: "t",
        themeName: "Dogs",
        beliefStatements: [],
      };
      expect(resolveType(base)).toBe("feed");
      expect(resolveType({ ...base, format: "reel" })).toBe("reel");
    }),
  );
});

const suggestion: CreatableSuggestion = {
  suggestionId: "s1",
  accountId: "acct_1",
  title: "Golden retriever Monday",
  themeName: "Dog content",
  beliefStatements: ["the resident golden retriever delights customers"],
};

const composition: Composition = {
  caption: "Come meet our resident golden this Monday ☕🐕",
  imagePrompts: [
    "a golden retriever by the espresso bar",
    "latte art close-up",
    "cozy winter corner",
  ],
};

describe("createPost (composed post under test layer)", () => {
  it.effect("composes a carousel grounded in the suggestion, in slide order", () =>
    Effect.gen(function* () {
      const imageGen = makeMockImageGen();
      const store = makeInMemoryCreateStore();
      const layer = Layer.mergeAll(
        makeStubRetrieval({ snippets: ["pet-friendly cafe"], themeSummary: "Pets" }),
        makeStubCaption(composition),
        imageGen.layer,
        store.layer,
      );

      const post = yield* createPost(suggestion).pipe(Effect.provide(layer));

      expect(post.type).toBe("feed");
      expect(post.caption).toBe(composition.caption);
      expect(post.imageIds).toHaveLength(3);
      expect(new Set(imageGen.prompts)).toEqual(new Set(composition.imagePrompts));
      // The persisted carousel preserves slide (prompt) order.
      expect(store.composed[0]!.images.map((image) => image.prompt)).toEqual(
        composition.imagePrompts,
      );
      expect(store.composed).toHaveLength(1);
      expect(store.composed[0]!.accountId).toBe("acct_1");
      expect(store.composed[0]!.suggestionId).toBe("s1");
      expect(store.composed[0]!.images).toHaveLength(3);
    }),
  );

  it.effect("falls back to a single slide when the model proposes no images", () =>
    Effect.gen(function* () {
      const imageGen = makeMockImageGen();
      const store = makeInMemoryCreateStore();
      const layer = Layer.mergeAll(
        makeStubRetrieval({ snippets: [], themeSummary: "" }),
        makeStubCaption({ caption: "hi", imagePrompts: [] }),
        imageGen.layer,
        store.layer,
      );

      const post = yield* createPost(suggestion).pipe(Effect.provide(layer));

      expect(post.imageIds).toHaveLength(1);
      expect(imageGen.prompts).toEqual([suggestion.title]);
    }),
  );

  it.effect("fails without persisting when an image cannot be generated", () =>
    Effect.gen(function* () {
      const imageGen = makeMockImageGen({ failOn: "latte art close-up" });
      const store = makeInMemoryCreateStore();
      const layer = Layer.mergeAll(
        makeStubRetrieval({ snippets: [], themeSummary: "" }),
        makeStubCaption(composition),
        imageGen.layer,
        store.layer,
      );

      const error = yield* createPost(suggestion).pipe(Effect.provide(layer), Effect.flip);

      expect(error._tag).toBe("ImageGenFailed");
      expect(store.composed).toHaveLength(0);
    }),
  );
});
