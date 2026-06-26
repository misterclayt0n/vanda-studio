import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { accountModes } from "./pipeline/constants";
import { signalColumns } from "./pipeline/storage";

/** Insert a signal if `(accountId, source, externalId)` is new; returns whether it was written. */
export const insertSignal = internalMutation({
  args: signalColumns,
  handler: async (ctx, signal) => {
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

/** The "Observando agora" feed: most recent signals for an account. */
export const listRecentSignals = internalQuery({
  args: { accountId: v.id("accounts"), limit: v.optional(v.number()) },
  handler: (ctx, { accountId, limit }) =>
    ctx.db
      .query("signals")
      .withIndex("by_account_observedAt", (q) => q.eq("accountId", accountId))
      .order("desc")
      .take(limit ?? 50),
});

/** Promote a connected Instagram account into a pipeline `accounts` row (idempotent). */
export const promoteConnection = internalMutation({
  args: {
    connectionId: v.id("instagramConnections"),
    mode: v.optional(v.union(...accountModes.map((mode) => v.literal(mode)))),
  },
  handler: async (ctx, { connectionId, mode }) => {
    const existing = await ctx.db
      .query("accounts")
      .withIndex("by_connection", (q) => q.eq("connectionId", connectionId))
      .first();
    if (existing !== null) return existing._id;
    const connection = await ctx.db.get(connectionId);
    if (connection === null) throw new Error("connection not found");
    const now = Date.now();
    return ctx.db.insert("accounts", {
      ownerUserId: connection.userId,
      connectionId,
      ...(connection.externalAccountName ? { name: connection.externalAccountName } : {}),
      mode: mode ?? "needs_approval",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Resolves the Instagram connection (id + encrypted token) for an account. */
export const getAccountConnection = internalQuery({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, { accountId }) => {
    const account = await ctx.db.get(accountId);
    if (account === null || account.connectionId === undefined) return null;
    const connection = await ctx.db.get(account.connectionId);
    if (connection === null) return null;
    return {
      igUserId: connection.externalAccountId,
      tokenCiphertext: connection.tokenCiphertext,
      tokenIv: connection.tokenIv,
      tokenAuthTag: connection.tokenAuthTag,
    };
  },
});

/** Cron target: schedule an observe pass for every account with a connection. */
export const observeAllAccounts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("accounts").collect();
    for (const account of accounts) {
      if (account.connectionId === undefined) continue;
      await ctx.scheduler.runAfter(0, internal.observeNode.observeAccount, {
        accountId: account._id,
      });
    }
  },
});
