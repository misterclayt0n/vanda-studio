"use node";

import { v } from "convex/values";
import * as Effect from "effect/Effect";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { decryptInstagramToken } from "./instagramToken";
import { igCommentsAdapter, igMentionsAdapter, signalsStoreLive } from "./pipeline/liveObserve";
import { observe } from "./pipeline/observe";

/**
 * Observe one account: resolve its Instagram connection, decrypt the token, and
 * run the observe program over the live source adapters. Best-effort — with no
 * connection there is nothing to observe, and source failures are logged inside
 * the program rather than aborting the pass.
 */
export const observeAccount = internalAction({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, { accountId }) => {
    const connection = await ctx.runQuery(internal.observe.getAccountConnection, { accountId });
    if (connection === null) return;
    const config = { igUserId: connection.igUserId, token: decryptInstagramToken(connection) };
    const adapters = [igCommentsAdapter(config), igMentionsAdapter(config)];
    await Effect.runPromise(
      observe(accountId, adapters).pipe(Effect.provide(signalsStoreLive(ctx))),
    );
  },
});
