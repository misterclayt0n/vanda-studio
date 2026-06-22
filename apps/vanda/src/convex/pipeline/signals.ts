import type * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { Signal } from "./domain";

/**
 * Persistence boundary for observed signals. The pipeline programs depend on
 * this contract, never on Convex directly — which is what lets the same program
 * run against an in-memory recorder in tests and against the Convex `ctx` in
 * production (see `live.ts` and `testing.ts`).
 *
 * `insert` is fallible: a Convex write can reject (write conflict, validator
 * rejection), so the failure is explicit in the error channel rather than
 * hidden as a defect.
 */
export interface SignalsShape {
  readonly insert: (signal: Signal) => Effect.Effect<void, Cause.UnknownError>;
}

export class Signals extends Context.Service<Signals, SignalsShape>()("@vanda/pipeline/Signals") {}
