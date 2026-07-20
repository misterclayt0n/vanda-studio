import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { signalColumns } from "./pipeline/storage";

/** Resolve the pipeline account behind an Instagram professional account id. */
export const accountConnectionByExternalId = internalQuery({
  args: { externalAccountId: v.string() },
  handler: async (ctx, { externalAccountId }) => {
    const connection = await ctx.db
      .query("instagramConnections")
      .withIndex("by_external_account", (q) =>
        q.eq("provider", "instagram_graph").eq("externalAccountId", externalAccountId),
      )
      .first();
    if (connection === null) return null;
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_connection", (q) => q.eq("connectionId", connection._id))
      .first();
    if (account === null) return null;
    return {
      accountId: account._id,
      igUserId: connection.externalAccountId,
      handle: connection.handle,
      tokenCiphertext: connection.tokenCiphertext,
      tokenIv: connection.tokenIv,
      tokenAuthTag: connection.tokenAuthTag,
    };
  },
});

/** Insert a signal received from an Instagram webhook using the same dedupe path as cron observe. */
export const insertWebhookSignal = internalMutation({
  args: signalColumns,
  handler: async (ctx, signal): Promise<boolean> => {
    const existing = await ctx.db
      .query("signals")
      .withIndex("by_account_source_external", (q) =>
        q
          .eq("accountId", signal.accountId)
          .eq("source", signal.source)
          .eq("externalId", signal.externalId),
      )
      .first();
    if (existing !== null) return false;
    await ctx.db.insert("signals", signal);
    return true;
  },
});

/** Store webhook subscription failures on the connection without blocking OAuth. */
export const recordSubscriptionError = internalMutation({
  args: { connectionId: v.id("instagramConnections"), error: v.union(v.string(), v.null()) },
  handler: async (ctx, { connectionId, error }) => {
    await ctx.db.patch(connectionId, {
      lastError: error ?? undefined,
      updatedAt: Date.now(),
    });
  },
});

export type WebhookAccountConnection = {
  accountId: Id<"accounts">;
  igUserId: string;
  handle: string | undefined;
  tokenCiphertext: string | undefined;
  tokenIv: string | undefined;
  tokenAuthTag: string | undefined;
};
