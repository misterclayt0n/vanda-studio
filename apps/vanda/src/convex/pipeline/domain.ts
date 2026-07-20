import * as Schema from "effect/Schema";
import { signalSources, signalSyncKinds } from "./constants";

/** Where an observed signal came from (the `observe` source, not a classification). */
export const SignalSource = Schema.Literals(signalSources);
export type SignalSource = typeof SignalSource.Type;

export const SignalSyncKind = Schema.Literals(signalSyncKinds);
export type SignalSyncKind = typeof SignalSyncKind.Type;

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
  readonly ingestedAt?: number | undefined;
  readonly syncKind?: SignalSyncKind | undefined;
  readonly mediaExternalId?: string | undefined;
  readonly mediaCaption?: string | undefined;
  readonly mediaType?: string | undefined;
  readonly mediaPublishedAt?: number | undefined;
  readonly isSelf?: boolean | undefined;
}

/** A raw signal scoped to the account it was observed for, ready to persist. */
export interface Signal extends RawSignal {
  readonly accountId: string;
}

/**
 * A persisted signal as consolidate consumes it: the stored row's id plus the
 * fields the judgment + evidence tracking need.
 */
export interface StoredSignal {
  readonly id: string;
  readonly source: SignalSource;
  readonly text: string;
  readonly observedAt: number;
  readonly authorHandle?: string | undefined;
  readonly permalink?: string | undefined;
  readonly ingestedAt?: number | undefined;
  readonly syncKind?: SignalSyncKind | undefined;
  readonly mediaExternalId?: string | undefined;
  readonly mediaCaption?: string | undefined;
  readonly mediaType?: string | undefined;
  readonly mediaPublishedAt?: number | undefined;
  readonly isSelf?: boolean | undefined;
}
