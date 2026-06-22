import type * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { RawSignal } from "./domain";

/**
 * Persistence boundary for observed signals: a single idempotent `insert`.
 * Inserting an already-seen `(accountId, source, externalId)` is a no-op that
 * returns `false`, so the observe stage's dedup costs one indexed lookup per
 * fetched item instead of scanning the account's whole signal history. Writes
 * are typed fallible.
 */
export interface SignalsShape {
  readonly insert: (
    accountId: string,
    signal: RawSignal,
  ) => Effect.Effect<boolean, Cause.UnknownError>;
}

export class Signals extends Context.Service<Signals, SignalsShape>()("@vanda/pipeline/Signals") {}
