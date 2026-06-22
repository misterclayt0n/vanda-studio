import type * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { OpenRouterClient, OpenRouterLanguageModel } from "@effect/ai-openrouter";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Signal } from "./domain";
import { Signals, type SignalsShape } from "./signals";

const DEFAULT_MODEL = "openai/gpt-4o-mini";

/**
 * The ctx-backed `Signals` layer — the production persistence seam. Writes go
 * through an internal mutation; a rejected write surfaces as a typed
 * `UnknownError`, never a silent defect. Exported so tests can exercise it with
 * a real action `ctx` (and a stub model) without the network.
 *
 * The explicit return type breaks the `api ↔ spike ↔ live` import cycle that
 * referencing `internal.spike.insertSignal` would otherwise introduce.
 */
export const signalsLayer = (ctx: ActionCtx): Layer.Layer<Signals> =>
  Layer.succeed(Signals, {
    insert: (signal: Signal): Effect.Effect<void, Cause.UnknownError> =>
      Effect.tryPromise(() => ctx.runMutation(internal.spike.insertSignal, signal)).pipe(
        Effect.asVoid,
      ),
  } satisfies SignalsShape);

/** OpenRouter-backed `LanguageModel`, wired over the platform fetch client. */
export const languageModelLayer = (apiKey: string): Layer.Layer<LanguageModel.LanguageModel> =>
  OpenRouterLanguageModel.layer({ model: DEFAULT_MODEL }).pipe(
    Layer.provide(OpenRouterClient.layer({ apiKey: Redacted.make(apiKey) })),
    Layer.provide(FetchHttpClient.layer),
  );

/**
 * The production layer for a pipeline stage running inside a Convex action:
 * `Signals` persists through `ctx`, the language model calls OpenRouter.
 */
export const liveLayer = (
  ctx: ActionCtx,
  apiKey: string,
): Layer.Layer<Signals | LanguageModel.LanguageModel> =>
  Layer.mergeAll(signalsLayer(ctx), languageModelLayer(apiKey));
