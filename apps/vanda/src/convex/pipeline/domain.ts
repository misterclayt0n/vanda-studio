import * as Schema from "effect/Schema";

/**
 * The classification kinds Vanda assigns to an observed signal. Modeled as a
 * literal union so the language model's structured output is constrained to
 * exactly these values.
 */
export const SignalKind = Schema.Literals(["praise", "question", "complaint", "other"]);
export type SignalKind = typeof SignalKind.Type;

/**
 * The structured output contract for the classify step. `generateObject` is
 * given this schema, so the model must return a value of this exact shape;
 * `salience` is bounded to 0–1 so out-of-range output fails decoding rather
 * than silently persisting.
 */
export const Classification = Schema.Struct({
  kind: SignalKind,
  salience: Schema.Number.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
});
export type Classification = typeof Classification.Type;

/** A raw Instagram comment fed into the observe stage. */
export interface IgComment {
  readonly externalId: string;
  readonly text: string;
}

/**
 * A persisted observation. In Phase 0 the only source is `comments`; later
 * phases widen `source` and enrich the shape.
 */
export interface Signal {
  readonly externalId: string;
  readonly accountExternalId: string;
  readonly source: "comments";
  readonly kind: SignalKind;
  readonly text: string;
  readonly salience: number;
  readonly observedAt: number;
}
