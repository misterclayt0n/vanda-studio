import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { accountModes } from "./pipeline/constants";

/**
 * The businesses this owner manages — powers the workspace switcher. Each row's
 * display name falls back through the explicit override, the connected IG account
 * name, then the handle. Scoped to the caller; returns `[]` when signed out.
 */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", user._id))
      .collect();

    return Promise.all(
      accounts.map(async (account) => {
        const connection = account.connectionId ? await ctx.db.get(account.connectionId) : null;
        return {
          id: account._id,
          name:
            account.name ?? connection?.externalAccountName ?? connection?.handle ?? "Novo negócio",
          mode: account.mode,
          handle: connection?.handle ?? null,
          connected: connection?.status === "connected",
        };
      }),
    );
  },
});

/** Set the autonomy mode (auto / needs_approval / manual) for a business the caller owns. */
export const setMode = mutation({
  args: {
    accountId: v.id("accounts"),
    mode: v.union(...accountModes.map((mode) => v.literal(mode))),
  },
  handler: async (ctx, { accountId, mode }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    const account = await ctx.db.get(accountId);
    if (!user || account === null || account.ownerUserId !== user._id) {
      throw new Error("account not found");
    }
    await ctx.db.patch(accountId, { mode, updatedAt: Date.now() });
  },
});
