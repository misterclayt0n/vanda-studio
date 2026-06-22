import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import type { RawSignal, SignalSource } from "./domain";
import { Signals } from "./signals";

/** A source adapter failed to fetch (network, API error). Non-fatal to a run. */
export class SourceFetchFailed extends Data.TaggedError("SourceFetchFailed")<{
  readonly source: SignalSource;
  readonly message: string;
}> {}

/**
 * A pluggable observation source. Each adapter owns one `source` and fetches its
 * latest raw signals. New signal sources (competitors, trends, X, store orders)
 * are new adapters — the observe program never changes.
 */
export interface SourceAdapter {
  readonly source: SignalSource;
  readonly fetch: () => Effect.Effect<ReadonlyArray<RawSignal>, SourceFetchFailed>;
}

/** Sources are independent, so they're fetched + persisted concurrently. */
const OBSERVE_CONCURRENCY = 4;

/**
 * The observe stage: run every source adapter and persist its fresh signals
 * (the idempotent `insert` drops anything already seen). ETL only — no
 * classification. A source fetch failure is logged and skipped so one flaky
 * source never aborts the run; a persistence failure is fatal (surfaced to the
 * caller). Returns the newly persisted signals.
 */
export const observe = Effect.fn("pipeline.observe")(function* (
  accountId: string,
  adapters: ReadonlyArray<SourceAdapter>,
) {
  const signals = yield* Signals;
  const perSource = yield* Effect.forEach(
    adapters,
    (adapter) =>
      Effect.gen(function* () {
        const fetched = yield* adapter.fetch();
        const groups = yield* Effect.forEach(fetched, (raw) =>
          Effect.map(signals.insert(accountId, raw), (inserted) => (inserted ? [raw] : [])),
        );
        return groups.flat();
      }).pipe(
        Effect.catchTag("SourceFetchFailed", (error) =>
          Effect.logWarning(`observe: source "${error.source}" failed: ${error.message}`).pipe(
            Effect.as([] as ReadonlyArray<RawSignal>),
          ),
        ),
      ),
    { concurrency: OBSERVE_CONCURRENCY },
  );
  return perSource.flat();
});
