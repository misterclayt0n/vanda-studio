import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import { Classification, type IgComment, type Signal } from "./domain";
import { Signals } from "./signals";

/** Comments are independent, so classification fans out concurrently. */
const CLASSIFY_CONCURRENCY = 4;

/**
 * Delimiter after which the comment text is appended verbatim. The test stub
 * keys on this to recover the comment, so prompt boilerplate above it can be
 * reworded without affecting deterministic test classification.
 */
export const COMMENT_MARKER = "COMMENT >>> ";

const classifyPrompt = (text: string) =>
  `You are classifying an Instagram comment for a small business.\n` +
  `Return the comment's kind and a salience score from 0 to 1.\n\n` +
  `${COMMENT_MARKER}${text}`;

/**
 * The Phase 0 vertical slice of `observe`: take a batch of comments, classify
 * each into a structured signal with the language model, and persist it.
 *
 * Requires `LanguageModel` and `Signals` — both satisfied by a layer at the
 * call site (live in a Convex action, mocked in tests).
 */
export const ingestComments = Effect.fn("pipeline.ingestComments")(function* (
  accountExternalId: string,
  comments: ReadonlyArray<IgComment>,
) {
  const signals = yield* Signals;

  return yield* Effect.forEach(
    comments,
    (comment) =>
      Effect.gen(function* () {
        const response = yield* LanguageModel.generateObject({
          prompt: classifyPrompt(comment.text),
          schema: Classification,
        });
        const observedAt = yield* Clock.currentTimeMillis;
        const signal: Signal = {
          externalId: comment.externalId,
          accountExternalId,
          source: "comments",
          kind: response.value.kind,
          text: comment.text,
          salience: response.value.salience,
          observedAt,
        };
        yield* signals.insert(signal);
        return signal;
      }),
    { concurrency: CLASSIFY_CONCURRENCY },
  );
});
