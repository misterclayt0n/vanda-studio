import { cancel, type WorkflowId } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";
import { requireOwnedAccount } from "./authz";
import { correctBeliefImpl, markSignalNoiseImpl } from "./steer";
import { signalSources } from "./pipeline/constants";

// ============================================================================
// The public app-API for the Automático screen. Everything is auth-gated on the
// caller owning the account; the pipeline internals (observe/plan/create/steer)
// stay internal — this is the thin read + control surface the board renders.
// ============================================================================

/** Map an account's beliefs by their statement — the provenance key suggestions cite. */
const beliefsByStatement = async (ctx: QueryCtx, accountId: Id<"accounts">) => {
  const beliefs = await ctx.db
    .query("beliefs")
    .withIndex("by_account_status", (q) => q.eq("accountId", accountId))
    .collect();
  return new Map(beliefs.map((b) => [b.statement, b] as const));
};

/** A suggestion projected to the plan-card shape the board renders. */
const toPlanCard = (s: Doc<"suggestions">, beliefs: Map<string, Doc<"beliefs">>) => {
  const primary = s.beliefStatements[0];
  const belief = primary ? beliefs.get(primary) : undefined;
  return {
    id: s._id,
    title: s.title,
    rationale: s.rationale,
    format: s.format ?? null,
    themeName: s.themeName,
    status: s.status,
    requiresApproval: s.requiresApproval,
    progress: s.progress ?? null,
    belief: belief ? { statement: belief.statement, confidence: belief.confidence } : null,
    createdAt: s.createdAt,
  };
};

/**
 * The Automático board for a business the caller owns: suggestions partitioned
 * by control status + the calendar's upcoming posts. Which column dominates is
 * the frontend's call by mode; this returns the raw pools.
 * - `needsYou`  → Precisa de você (status `needs_you`)
 * - `creating`  → Vanda fazendo (status `creating`, carries `progress`)
 * - `pool`      → Fila de revisão / Propostas da Vanda (status `suggestion`/`approved`)
 * - `scheduled` → Agendado (scheduledPosts joined to their post + provenance)
 */
export const board = query({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, { accountId }) => {
    await requireOwnedAccount(ctx, accountId);
    const beliefs = await beliefsByStatement(ctx, accountId);

    const suggestions = await ctx.db
      .query("suggestions")
      .withIndex("by_account_created", (q) => q.eq("accountId", accountId))
      .order("desc")
      .collect();
    const cards = suggestions.map((s) => toPlanCard(s, beliefs));
    const needsYou = cards.filter((c) => c.status === "needs_you");
    const creating = cards.filter((c) => c.status === "creating");
    const pool = cards.filter((c) => c.status === "suggestion" || c.status === "approved");

    const scheduledRows = await ctx.db
      .query("scheduledPosts")
      .withIndex("by_account_scheduledFor", (q) => q.eq("accountId", accountId))
      .order("asc")
      .collect();
    const scheduled = await Promise.all(
      scheduledRows
        .filter((r) => r.status !== "published" && r.status !== "failed")
        .map(async (r) => {
          const post = await ctx.db.get(r.postId);
          const suggestion = post?.suggestionId ? await ctx.db.get(post.suggestionId) : null;
          const primary = suggestion?.beliefStatements[0];
          const belief = primary ? beliefs.get(primary) : undefined;
          return {
            id: r._id,
            title: suggestion?.title ?? "Post agendado",
            format: post?.type ?? null,
            scheduledFor: r.scheduledFor,
            status: r.status,
            belief: belief ? { statement: belief.statement, confidence: belief.confidence } : null,
          };
        }),
    );

    return { needsYou, creating, pool, scheduled };
  },
});

/** How a learned belief cashes out — drives the "→ 1 ideia / → agenda / → precisa de você" hint. */
type LearnedHint = "idea" | "agenda" | "needs_you" | null;
const hintFor = (statement: string, suggestions: Doc<"suggestions">[]): LearnedHint => {
  const citing = suggestions.filter((s) => s.beliefStatements.includes(statement));
  if (citing.some((s) => s.status === "scheduled")) return "agenda";
  if (citing.some((s) => s.status === "needs_you")) return "needs_you";
  if (citing.some((s) => ["suggestion", "approved", "creating"].includes(s.status))) return "idea";
  return null;
};

/**
 * The Observando rail: the raw context Vanda watches (signals grouped by source,
 * latest + count) and "O que aprendi" — the strongest live beliefs with the
 * count of signals behind each and how it cashes out.
 */
export const observing = query({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, { accountId }) => {
    await requireOwnedAccount(ctx, accountId);
    const recent = await ctx.db
      .query("signals")
      .withIndex("by_account_observedAt", (q) => q.eq("accountId", accountId))
      .order("desc")
      .take(200);

    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const totalToday = recent.filter((s) => s.observedAt >= dayAgo).length;

    const sources = signalSources.map((source) => {
      const forSource = recent.filter((s) => s.source === source && s.noise !== true);
      const latest = forSource[0];
      return {
        source,
        count: forSource.length,
        latest: latest
          ? {
              text: latest.text,
              authorHandle: latest.authorHandle ?? null,
              permalink: latest.permalink ?? null,
              observedAt: latest.observedAt,
            }
          : null,
      };
    });

    const beliefs = await ctx.db
      .query("beliefs")
      .withIndex("by_account_status", (q) => q.eq("accountId", accountId))
      .collect();
    const suggestions = await ctx.db
      .query("suggestions")
      .withIndex("by_account_created", (q) => q.eq("accountId", accountId))
      .collect();
    const learned = beliefs
      .filter((b) => b.status !== "retired")
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 6)
      .map((b) => ({
        id: b._id,
        statement: b.statement,
        confidence: b.confidence,
        kind: b.kind,
        signalCount: b.supportingSignalIds.length,
        hint: hintFor(b.statement, suggestions),
      }));

    return { totalToday, sources, learned };
  },
});

type LineageSignal = {
  id: Id<"signals">;
  text: string;
  authorHandle: string | null;
  permalink: string | null;
  source: Doc<"signals">["source"];
  salience: number | null;
  noise: boolean;
};

/**
 * Intervir na linhagem: the reasoning behind one idea — its primary belief, the
 * signals that sustain it (salient-first, noise-flagged), and the count Vanda
 * saw but didn't lean on. The owner steers this via `markNoise`/`correctBelief`.
 */
export const lineage = query({
  args: { suggestionId: v.id("suggestions") },
  handler: async (ctx, { suggestionId }) => {
    const suggestion = await ctx.db.get(suggestionId);
    if (suggestion === null) throw new Error("suggestion not found");
    await requireOwnedAccount(ctx, suggestion.accountId);

    const primary = suggestion.beliefStatements[0];
    const beliefRow = primary
      ? ((
          await ctx.db
            .query("beliefs")
            .withIndex("by_account_status", (q) => q.eq("accountId", suggestion.accountId))
            .collect()
        ).find((b) => b.statement === primary) ?? null)
      : null;

    let salientSignals: LineageSignal[] = [];
    if (beliefRow) {
      const rows = await Promise.all(
        beliefRow.supportingSignalIds.map((id) => ctx.db.get(id as Id<"signals">)),
      );
      salientSignals = rows
        .filter((s): s is Doc<"signals"> => s !== null)
        .sort((a, b) => (b.salience ?? 0) - (a.salience ?? 0))
        .map((s) => ({
          id: s._id,
          text: s.text,
          authorHandle: s.authorHandle ?? null,
          permalink: s.permalink ?? null,
          source: s.source,
          salience: s.salience ?? null,
          noise: s.noise === true,
        }));
    }

    const total = (
      await ctx.db
        .query("signals")
        .withIndex("by_account_observedAt", (q) => q.eq("accountId", suggestion.accountId))
        .collect()
    ).length;

    return {
      suggestion: { id: suggestion._id, title: suggestion.title },
      belief: beliefRow
        ? {
            id: beliefRow._id,
            statement: beliefRow.statement,
            confidence: beliefRow.confidence,
            kind: beliefRow.kind,
          }
        : null,
      salientSignals,
      discardedCount: Math.max(0, total - salientSignals.length),
    };
  },
});

// --- Control actions (per-item, never "approve the whole pipeline") ----------

/** Dispensar: drop an idea. Cancels an in-flight create first so nothing is orphaned. */
export const dismiss = mutation({
  args: { suggestionId: v.id("suggestions") },
  handler: async (ctx, { suggestionId }) => {
    const suggestion = await ctx.db.get(suggestionId);
    if (suggestion === null) throw new Error("suggestion not found");
    await requireOwnedAccount(ctx, suggestion.accountId);
    if (suggestion.status === "dismissed") return;
    if (suggestion.status === "creating" && suggestion.workflowId !== undefined) {
      await cancel(ctx, components.workflow, suggestion.workflowId as WorkflowId);
    }
    await ctx.db.patch(suggestionId, { status: "dismissed" });
  },
});

/** Marcar como ruído: the lineage's owner-steers-the-reasoning action (auth + recompute). */
export const markNoise = mutation({
  args: { signalId: v.id("signals") },
  handler: async (ctx, { signalId }) => {
    const signal = await ctx.db.get(signalId);
    if (signal === null) throw new Error("signal not found");
    await requireOwnedAccount(ctx, signal.accountId);
    await markSignalNoiseImpl(ctx, signalId);
  },
});

/** Corrigir crença: rename a belief; suggestions citing it are re-pointed to the new wording. */
export const correctBelief = mutation({
  args: { beliefId: v.id("beliefs"), statement: v.string() },
  handler: async (ctx, { beliefId, statement }) => {
    const belief = await ctx.db.get(beliefId);
    if (belief === null) throw new Error("belief not found");
    await requireOwnedAccount(ctx, belief.accountId);
    await correctBeliefImpl(ctx, beliefId, statement);
  },
});
