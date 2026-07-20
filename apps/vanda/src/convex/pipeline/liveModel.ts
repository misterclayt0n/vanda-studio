import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import type * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { OpenRouterClient, OpenRouterLanguageModel } from "@effect/ai-openrouter";

/** Models are stage-addressable so quality can be evaluated and upgraded independently. */
export const PIPELINE_MODELS = {
  brandProfile: "openai/gpt-5-nano",
  consolidate: "openai/gpt-5-nano",
  plan: "openai/gpt-5-nano",
  create: "openai/gpt-5-nano",
} as const;

export const DEFAULT_MODEL = PIPELINE_MODELS.consolidate;

/** OpenRouter-backed `LanguageModel`, wired over the platform fetch client. */
export const languageModelLayer = (
  apiKey: string,
  model: string = DEFAULT_MODEL,
): Layer.Layer<LanguageModel.LanguageModel> =>
  OpenRouterLanguageModel.layer({ model }).pipe(
    Layer.provide(OpenRouterClient.layer({ apiKey: Redacted.make(apiKey) })),
    Layer.provide(FetchHttpClient.layer),
  );

/**
 * Convex mutation args are deeply mutable; our domain values are deeply readonly
 * (Schema-derived). Erases readonly at the wire boundary — values are identical,
 * only the mutability annotation differs.
 */
export type Mutable<T> =
  T extends ReadonlyArray<infer U>
    ? Array<Mutable<U>>
    : T extends object
      ? { -readonly [K in keyof T]: Mutable<T[K]> }
      : T;
