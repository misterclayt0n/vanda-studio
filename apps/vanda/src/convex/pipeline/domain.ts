import * as Schema from "effect/Schema";
import { signalSources } from "./constants";

/** Where an observed signal came from (the `observe` source, not a classification). */
export const SignalSource = Schema.Literals(signalSources);
export type SignalSource = typeof SignalSource.Type;

/**
 * A signal as emitted by a source adapter, before persistence. Raw observation
 * only — classification (kind/salience) is the consolidate stage's job, not
 * observe's.
 */
export interface RawSignal {
  readonly source: SignalSource;
  readonly externalId: string;
  readonly text: string;
  readonly authorHandle?: string | undefined;
  readonly permalink?: string | undefined;
  readonly observedAt: number;
}

/** A raw signal scoped to the account it was observed for, ready to persist. */
export interface Signal extends RawSignal {
  readonly accountId: string;
}
