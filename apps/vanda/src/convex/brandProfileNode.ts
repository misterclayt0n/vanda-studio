"use node";

import { v } from "convex/values";
import * as Effect from "effect/Effect";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { decryptInstagramToken } from "./instagramToken";
import type { BrandAnalysis, CorpusStats } from "./pipeline/brand";
import { proposeBrandProfile } from "./pipeline/brandProfile";
import { fetchBrandCorpus } from "./pipeline/liveBrand";
import { languageModelLayer } from "./pipeline/liveModel";

/**
 * Onboarding's "Vanda is reading your account" step: resolve the caller's owned
 * connection, fetch the brand corpus + counts, and run one structured LLM pass into
 * a `BrandAnalysis`. Returns the analysis (for the Confirmar screen to edit) plus
 * the corpus stats (the "LI N POSTS · …" trust line) — not persisted, so re-running
 * on a refresh is safe (idempotent, no writes). Explicit return type breaks the
 * `api ↔ brandProfile ↔ brandProfileNode` cycle.
 */
export const analyzeAccount = action({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, { accountId }): Promise<{ analysis: BrandAnalysis; stats: CorpusStats }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const connection = await ctx.runQuery(internal.brandProfile.resolveOwnedConnection, {
      accountId,
      clerkId: identity.subject,
    });
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set on the Convex deployment");
    const token = decryptInstagramToken(connection);
    return Effect.runPromise(
      Effect.gen(function* () {
        const { corpus, stats } = yield* fetchBrandCorpus({
          igUserId: connection.igUserId,
          token,
        });
        const analysis = yield* proposeBrandProfile(corpus);
        return { analysis, stats };
      }).pipe(Effect.provide(languageModelLayer(apiKey))),
    );
  },
});
