import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalQuery,
  mutation,
  type MutationCtx,
  type QueryCtx,
  query,
} from "./_generated/server";
import * as Schema from "effect/Schema";
import { BrandAnalysis, type BrandCanonKind } from "./pipeline/brand";
import { brandAnalysisArgs } from "./pipeline/storage";

/** Resolve the caller's owned account or throw — the auth gate for every brand op. */
async function requireOwnedAccount(ctx: QueryCtx | MutationCtx, accountId: Id<"accounts">) {
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
  return account;
}

/**
 * The Instagram connection (id + encrypted token) for an account the caller owns.
 * Internal-only — it returns token ciphertext, so it must never be a public
 * function. `analyzeAccount` (brandProfileNode.ts) passes its verified `clerkId`;
 * ownership is re-checked here against the account before any secret is handed out.
 */
export const resolveOwnedConnection = internalQuery({
  args: { accountId: v.id("accounts"), clerkId: v.string() },
  handler: async (ctx, { accountId, clerkId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    const account = await ctx.db.get(accountId);
    if (!user || account === null || account.ownerUserId !== user._id) {
      throw new Error("account not found");
    }
    if (account.connectionId === undefined) throw new Error("account has no Instagram connection");
    const connection = await ctx.db.get(account.connectionId);
    if (connection === null) throw new Error("connection not found");
    return {
      igUserId: connection.externalAccountId,
      tokenCiphertext: connection.tokenCiphertext,
      tokenIv: connection.tokenIv,
      tokenAuthTag: connection.tokenAuthTag,
    };
  },
});

/** Shapes of the analysis cards `approveBrandProfile` flattens into canon rows. */
type CanonCard = { readonly text: string; readonly evidence: string; readonly confidence: number };
type CanonGroup = {
  readonly items: ReadonlyArray<string>;
  readonly evidence: string;
  readonly confidence: number;
};

const canonFromText = (kind: BrandCanonKind, card: CanonCard) => ({
  kind,
  text: card.text,
  evidence: card.evidence,
  confidence: card.confidence,
});

const canonFromGroup = (kind: BrandCanonKind, group: CanonGroup) =>
  group.items.map((text) => ({
    kind,
    text,
    evidence: group.evidence,
    confidence: group.confidence,
  }));

/**
 * Confirm the brand profile — the end of onboarding. Validates the owner-approved
 * analysis against the domain contract (rejecting out-of-range confidence), then
 * writes it as canon (`identity`/`summary` single rows; `voice`/`character`/
 * `restriction` one row per chip) and seeds the detected `themes`, then stamps
 * `onboardedAt`. Opportunities are previews only — the planner earns the first
 * real suggestions from observed evidence, so onboarding never hand-seeds them
 * (a "suggestion"-status row is regenerable and a plan pass would erase it).
 * Single-use: re-confirming after onboarding is rejected — later memory edits get
 * their own mutation. Canon is fully replaced so a retry before completion stays
 * idempotent.
 */
export const approveBrandProfile = mutation({
  args: { accountId: v.id("accounts"), ...brandAnalysisArgs },
  handler: async (ctx, args) => {
    const account = await requireOwnedAccount(ctx, args.accountId);
    if (account.onboardedAt !== undefined) throw new Error("account already onboarded");
    const { accountId, ...rest } = args;
    // The public mutation's v.number() args don't enforce UnitInterval; decode against
    // the domain contract so an out-of-range confidence is rejected, not persisted.
    const analysis = Schema.decodeSync(BrandAnalysis)(rest);
    const now = Date.now();

    const canon = [
      canonFromText("identity", analysis.identity),
      canonFromText("summary", analysis.summary),
      ...canonFromGroup("voice", analysis.voice),
      ...canonFromGroup("character", analysis.characters),
      ...canonFromGroup("restriction", analysis.restrictions),
    ];

    // Clean replace: drop any prior canon for this account, then insert confirmed rows.
    const existingCanon = await ctx.db
      .query("brandCanon")
      .withIndex("by_account", (q) => q.eq("accountId", accountId))
      .collect();
    for (const row of existingCanon) await ctx.db.delete(row._id);
    for (const item of canon) {
      await ctx.db.insert("brandCanon", {
        accountId,
        ...item,
        confirmedByOwner: true,
        createdAt: now,
      });
    }

    // Seed detected themes (upsert by name — consolidate may already own some).
    const existingThemes = await ctx.db
      .query("themes")
      .withIndex("by_account", (q) => q.eq("accountId", accountId))
      .collect();
    const themeNames = new Set(existingThemes.map((t) => t.name));
    for (const name of analysis.themes.items) {
      if (themeNames.has(name)) continue;
      themeNames.add(name); // also dedup chips repeated within this same approval
      await ctx.db.insert("themes", {
        accountId,
        name,
        summary: analysis.themes.evidence,
        momentum: "steady",
        postCount: 0,
        signalCount: 0,
      });
    }

    await ctx.db.patch(accountId, { onboardedAt: now, updatedAt: now });
  },
});

/** The "what Vanda knows about your brand" panel: confirmed canon for an owned account. */
export const getBrandCanon = query({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, { accountId }) => {
    await requireOwnedAccount(ctx, accountId);
    return ctx.db
      .query("brandCanon")
      .withIndex("by_account", (q) => q.eq("accountId", accountId))
      .collect();
  },
});
