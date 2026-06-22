import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import type { Classification, Signal } from "./domain";
import { COMMENT_MARKER } from "./observe";
import { Signals, type SignalsShape } from "./signals";

/**
 * Recovers just the comment from the prompt (everything after the marker) so
 * classification depends only on the comment under test, not on the prompt's
 * surrounding boilerplate.
 */
const commentOf = (prompt: string): string => {
  const at = prompt.lastIndexOf(COMMENT_MARKER);
  return at === -1 ? prompt : prompt.slice(at + COMMENT_MARKER.length);
};

const KIND_RULES: ReadonlyArray<readonly [RegExp, Classification["kind"]]> = [
  [/\b(love|amazing|great|delicious|best)\b|!/i, "praise"],
  [/\?/, "question"],
  [/\b(bad|terrible|awful|slow|rude|cold)\b/i, "complaint"],
];

/** Deterministic, network-free classifier used by the stub model. */
export const keywordClassify = (prompt: string): Classification => {
  const comment = commentOf(prompt);
  for (const [pattern, kind] of KIND_RULES) {
    if (pattern.test(comment)) return { kind, salience: 0.6 };
  }
  return { kind: "other", salience: 0.3 };
};

/**
 * A test `LanguageModel` layer whose `generateObject` returns a deterministic
 * value. The pipeline only ever calls `generateObject`; `generateText` and
 * `streamText` fail loudly (and consistently, as deferred Effect/Stream
 * failures) so a future stage cannot silently depend on them.
 *
 * The single cast bridges our concrete `generateObject` to the provider's
 * fully-generic `Service` signature — unavoidable for a test double of a
 * generic provider interface, and confined to this test-only helper.
 */
export const makeStubLanguageModel = (classify: (prompt: string) => Classification) =>
  Layer.succeed(LanguageModel.LanguageModel, {
    generateObject: (options: { readonly prompt: unknown }) =>
      Effect.sync(() => {
        const prompt =
          typeof options.prompt === "string" ? options.prompt : JSON.stringify(options.prompt);
        return new LanguageModel.GenerateObjectResponse(classify(prompt), []);
      }),
    generateText: () => Effect.die("stub LanguageModel: generateText is not supported"),
    streamText: () => Stream.die("stub LanguageModel: streamText is not supported"),
  } as unknown as LanguageModel.Service);

/** Captures every inserted signal so tests can assert on persisted content. */
export interface SignalsRecorder {
  readonly layer: Layer.Layer<Signals>;
  readonly stored: ReadonlyArray<Signal>;
}

export const makeSignalsRecorder = (): SignalsRecorder => {
  const stored: Array<Signal> = [];
  const layer = Layer.succeed(Signals, {
    insert: (signal: Signal) =>
      Effect.sync(() => {
        stored.push(signal);
      }),
  } satisfies SignalsShape);
  return { layer, stored };
};

/** Full in-memory test layer plus a handle to the recorded signals. */
export const makeTestLayer = (): {
  readonly layer: Layer.Layer<LanguageModel.LanguageModel | Signals>;
  readonly signals: ReadonlyArray<Signal>;
} => {
  const recorder = makeSignalsRecorder();
  return {
    layer: Layer.mergeAll(makeStubLanguageModel(keywordClassify), recorder.layer),
    signals: recorder.stored,
  };
};
