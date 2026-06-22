import { v } from "convex/values";
import * as Effect from "effect/Effect";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { liveLayer } from "./pipeline/live";
import { ingestComments } from "./pipeline/observe";
import { signalColumns } from "./pipeline/storage";

export const insertSignal = internalMutation({
  args: signalColumns,
  handler: (ctx, signal) => ctx.db.insert("signals", signal),
});

export const listByAccount = internalQuery({
  args: { accountExternalId: v.string() },
  handler: (ctx, { accountExternalId }) =>
    ctx.db
      .query("signals")
      .withIndex("by_account_external", (q) => q.eq("accountExternalId", accountExternalId))
      .collect(),
});

/**
 * Phase 0 boundary action: runs the Effect `observe` program inside a Convex
 * action with the live layer. Proves Effect v4 + the OpenRouter provider bundle
 * and execute in the real Convex runtime, persisting through `ctx`.
 */
export const ingestAccountComments = internalAction({
  args: {
    accountExternalId: v.string(),
    comments: v.array(v.object({ externalId: v.string(), text: v.string() })),
  },
  handler: (ctx, { accountExternalId, comments }) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not set on the Convex deployment");
    }
    return Effect.runPromise(
      ingestComments(accountExternalId, comments).pipe(Effect.provide(liveLayer(ctx, apiKey))),
    );
  },
});
