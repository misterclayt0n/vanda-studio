import type * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { OpenRouterClient, OpenRouterLanguageModel } from "@effect/ai-openrouter";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import {
  Memory,
  type ConsolidationResult,
  type MemoryShape,
  type MemorySnapshot,
} from "./memoryStore";

const DEFAULT_MODEL = "openai/gpt-4o-mini";

const accountKey = (id: string): Id<"accounts"> => id as Id<"accounts">;

/**
 * Convex mutation args are deeply mutable; our domain values are deeply readonly
 * (Schema-derived). This erases readonly at the wire boundary — values identical,
 * only the mutability annotation differs.
 */
type Mutable<T> =
  T extends ReadonlyArray<infer U>
    ? Array<Mutable<U>>
    : T extends object
      ? { -readonly [K in keyof T]: Mutable<T[K]> }
      : T;

/** OpenRouter-backed `LanguageModel`, wired over the platform fetch client. */
export const languageModelLayer = (apiKey: string): Layer.Layer<LanguageModel.LanguageModel> =>
  OpenRouterLanguageModel.layer({ model: DEFAULT_MODEL }).pipe(
    Layer.provide(OpenRouterClient.layer({ apiKey: Redacted.make(apiKey) })),
    Layer.provide(FetchHttpClient.layer),
  );

/**
 * `Memory` backed by the Convex action `ctx`: snapshot reads run a query, a pass
 * writes through one mutation. Explicit method return types break the
 * `api ↔ consolidateAction ↔ liveConsolidate` import cycle.
 */
export const memoryStoreLive = (ctx: ActionCtx): Layer.Layer<Memory> =>
  Layer.succeed(Memory, {
    loadSnapshot: (accountId: string): Effect.Effect<MemorySnapshot, Cause.UnknownError> =>
      Effect.tryPromise(() =>
        ctx.runQuery(internal.consolidate.loadSnapshot, { accountId: accountKey(accountId) }),
      ),
    apply: (
      accountId: string,
      result: ConsolidationResult,
    ): Effect.Effect<void, Cause.UnknownError> =>
      Effect.tryPromise(() =>
        ctx.runMutation(internal.consolidate.applyConsolidation, {
          accountId: accountKey(accountId),
          beliefs: result.beliefs as unknown as Mutable<ConsolidationResult["beliefs"]>,
          themes: result.themes as unknown as Mutable<ConsolidationResult["themes"]>,
          note: result.note,
          consumedSignalIds: [...result.consumedSignalIds],
        }),
      ).pipe(Effect.asVoid),
  } satisfies MemoryShape);

/**
 * The production layer for the consolidate stage inside a Convex action:
 * `Memory` persists through `ctx`, the language model calls OpenRouter.
 */
export const consolidateLayer = (
  ctx: ActionCtx,
  apiKey: string,
): Layer.Layer<Memory | LanguageModel.LanguageModel> =>
  Layer.mergeAll(memoryStoreLive(ctx), languageModelLayer(apiKey));
