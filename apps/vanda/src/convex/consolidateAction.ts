import { v } from "convex/values";
import * as Effect from "effect/Effect";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { consolidate } from "./pipeline/consolidate";
import { consolidateLayer } from "./pipeline/liveConsolidate";

/**
 * Consolidate one account: fold its pending signals into belief/theme memory
 * with the model, persisting the deltas. Best-effort — nothing to do with no
 * pending signals, and a model/persistence failure leaves the signals
 * unconsolidated for the next cycle (nothing is half-applied).
 */
export const consolidateAccount = internalAction({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, { accountId }) => {
    const signals = await ctx.runQuery(internal.consolidate.listUnconsolidatedSignals, {
      accountId,
    });
    if (signals.length === 0) return;
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set on the Convex deployment");
    const inputs = signals.map((signal) => ({
      id: signal._id,
      source: signal.source,
      text: signal.text,
      observedAt: signal.observedAt,
    }));
    await Effect.runPromise(
      consolidate(accountId, inputs).pipe(Effect.provide(consolidateLayer(ctx, apiKey))),
    );
  },
});
