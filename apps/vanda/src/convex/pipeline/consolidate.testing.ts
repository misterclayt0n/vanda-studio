import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import type { SignalJudgment } from "./consolidate";
import { type Belief, defaultPolicy, type Policy, type Theme } from "./memory";
import {
  type ConsolidationResult,
  Memory,
  type MemoryShape,
  type MemorySnapshot,
} from "./memoryStore";

/**
 * A test `LanguageModel` whose `generateObject` returns a deterministic judgment
 * for each prompt. The pipeline only ever calls `generateObject`; `generateText`
 * and `streamText` fail loudly (as deferred Effect/Stream failures) so a future
 * stage cannot silently depend on them.
 *
 * The single cast bridges our concrete `generateObject` to the provider's
 * fully-generic `Service` signature — unavoidable for a test double of a generic
 * provider interface, and confined to this test-only helper.
 */
export const makeStubConsolidator = (judge: (prompt: string) => SignalJudgment) =>
  Layer.succeed(LanguageModel.LanguageModel, {
    generateObject: (options: { readonly prompt: unknown }) =>
      Effect.sync(() => {
        const prompt =
          typeof options.prompt === "string" ? options.prompt : JSON.stringify(options.prompt);
        return new LanguageModel.GenerateObjectResponse(judge(prompt), []);
      }),
    generateText: () => Effect.die("stub LanguageModel: generateText is not supported"),
    streamText: () => Stream.die("stub LanguageModel: streamText is not supported"),
  } as unknown as LanguageModel.Service);

/** A stub model that always fails — for the model-failure-aborts-the-pass path. */
export const failingConsolidator = Layer.succeed(LanguageModel.LanguageModel, {
  generateObject: () => Effect.fail(new Error("stub LanguageModel failure")),
  generateText: () => Effect.die("stub LanguageModel: generateText is not supported"),
  streamText: () => Stream.die("stub LanguageModel: streamText is not supported"),
} as unknown as LanguageModel.Service);

export interface MemoryRecorder {
  readonly layer: Layer.Layer<Memory>;
  /** Every result `apply` received, in order. */
  readonly applied: ReadonlyArray<ConsolidationResult>;
  /** The current persisted snapshot (reflects applied results). */
  readonly snapshot: () => MemorySnapshot;
}

/**
 * In-memory `Memory` seeded with beliefs/themes/policy. `loadSnapshot` returns
 * the live state and `apply` folds a result back in, so consecutive
 * `consolidate` runs see each other's writes (evidence accrues across passes).
 */
export const makeMemoryRecorder = (
  seed: {
    readonly beliefs?: ReadonlyArray<Belief>;
    readonly themes?: ReadonlyArray<Theme>;
    readonly policy?: Policy;
  } = {},
): MemoryRecorder => {
  let beliefs: ReadonlyArray<Belief> = seed.beliefs ?? [];
  let themes: ReadonlyArray<Theme> = seed.themes ?? [];
  const policy = seed.policy ?? defaultPolicy;
  const applied: Array<ConsolidationResult> = [];

  const layer = Layer.succeed(Memory, {
    loadSnapshot: () => Effect.sync(() => ({ beliefs, themes, policy })),
    apply: (_accountId, result) =>
      Effect.sync(() => {
        beliefs = result.beliefs;
        themes = result.themes;
        applied.push(result);
      }),
  } satisfies MemoryShape);

  return { layer, applied, snapshot: () => ({ beliefs, themes, policy }) };
};
