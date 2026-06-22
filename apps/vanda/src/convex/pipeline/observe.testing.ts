import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { RawSignal, Signal, SignalSource } from "./domain";
import { type SourceAdapter, SourceFetchFailed } from "./observe";
import { Signals, type SignalsShape } from "./signals";

/** An adapter that yields fixed items (its `source` is stamped onto each). */
export const fakeAdapter = (
  source: SignalSource,
  items: ReadonlyArray<Omit<RawSignal, "source">>,
): SourceAdapter => ({
  source,
  fetch: () =>
    Effect.succeed(
      items.map((item) => ({
        source,
        externalId: item.externalId,
        text: item.text,
        observedAt: item.observedAt,
        authorHandle: item.authorHandle,
        permalink: item.permalink,
      })),
    ),
});

/** An adapter whose fetch always fails — for the resilience path. */
export const failingAdapter = (source: SignalSource): SourceAdapter => ({
  source,
  fetch: () => Effect.fail(new SourceFetchFailed({ source, message: "fake source failure" })),
});

export interface SignalsRecorder {
  readonly layer: Layer.Layer<Signals>;
  readonly stored: ReadonlyArray<Signal>;
}

/**
 * In-memory `Signals` store. Dedups by `(accountId, source, externalId)` and
 * records inserts. `failOnInsert` makes every insert fail, to pin the
 * store-failure-is-fatal half of the observe resilience contract.
 */
export const makeSignalsRecorder = (
  options: { readonly seed?: ReadonlyArray<Signal>; readonly failOnInsert?: boolean } = {},
): SignalsRecorder => {
  const stored: Array<Signal> = [...(options.seed ?? [])];
  const layer = Layer.succeed(Signals, {
    insert: (accountId: string, signal: RawSignal) =>
      options.failOnInsert === true
        ? Effect.fail(new Cause.UnknownError("forced", "fake store failure"))
        : Effect.sync(() => {
            const seen = stored.some(
              (existing) =>
                existing.accountId === accountId &&
                existing.source === signal.source &&
                existing.externalId === signal.externalId,
            );
            if (seen) return false;
            stored.push({ accountId, ...signal });
            return true;
          }),
  } satisfies SignalsShape);
  return { layer, stored };
};
