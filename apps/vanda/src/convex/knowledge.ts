import { v } from "convex/values";
import * as Effect from "effect/Effect";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { knowledgeKinds } from "./pipeline/constants";
import { EMBEDDING_MODEL, Embeddings, embeddingsLive } from "./pipeline/embeddings";
import { PROMPT_VERSIONS } from "./pipeline/liveModel";
import { runTracked } from "./pipeline/liveTelemetry";

type KnowledgeKind = (typeof knowledgeKinds)[number];
interface KnowledgeSource {
  readonly kind: KnowledgeKind;
  readonly sourceId: string;
  readonly text: string;
  readonly observedAt?: number | undefined;
}

export const sources = internalQuery({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, { accountId }): Promise<KnowledgeSource[]> => {
    const account = await ctx.db.get(accountId);
    const canon = await ctx.db
      .query("brandCanon")
      .withIndex("by_account", (q) => q.eq("accountId", accountId))
      .collect();
    const beliefs = await ctx.db
      .query("beliefs")
      .withIndex("by_account_status", (q) => q.eq("accountId", accountId))
      .collect();
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_account", (q) => q.eq("accountId", accountId))
      .collect();
    const suggestions = await ctx.db
      .query("suggestions")
      .withIndex("by_account_created", (q) => q.eq("accountId", accountId))
      .order("desc")
      .take(100);
    const instagramPosts =
      account?.connectionId === undefined
        ? []
        : await ctx.db
            .query("instagramPosts")
            .withIndex("by_connection_external", (q) => q.eq("connectionId", account.connectionId!))
            .collect();

    return [
      ...canon
        .filter((entry) => entry.confirmedByOwner)
        .map((entry) => ({
          kind: "canon" as const,
          sourceId: `canon:${entry._id}`,
          text: `${entry.kind}: ${entry.text}`,
        })),
      ...beliefs
        .filter((belief) => belief.status !== "retired")
        .map((belief) => ({
          kind: "belief" as const,
          sourceId: `belief:${belief._id}`,
          text: belief.statement,
          observedAt: belief.confidenceAsOf,
        })),
      ...instagramPosts.flatMap((post) =>
        post.caption === undefined
          ? []
          : [
              {
                kind: "caption" as const,
                sourceId: `instagram:${post.externalPostId}`,
                text: post.caption,
                observedAt: post.publishedAt,
              },
            ],
      ),
      ...posts.map((post) => ({
        kind: "post" as const,
        sourceId: `post:${post._id}`,
        text: post.caption,
        observedAt: post.createdAt,
      })),
      ...suggestions.flatMap((suggestion) =>
        suggestion.status !== "dismissed" && suggestion.status !== "rejected"
          ? []
          : [
              {
                kind: "feedback" as const,
                sourceId: `suggestion:${suggestion._id}`,
                text: `Proposta descartada: ${suggestion.title}. ${suggestion.rejectionReason ?? suggestion.rationale}`,
                observedAt: suggestion.createdAt,
              },
            ],
      ),
    ];
  },
});

export const replace = internalMutation({
  args: {
    accountId: v.id("accounts"),
    chunks: v.array(
      v.object({
        kind: v.union(...knowledgeKinds.map((kind) => v.literal(kind))),
        sourceId: v.string(),
        text: v.string(),
        embedding: v.array(v.float64()),
        observedAt: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { accountId, chunks }) => {
    const existing = await ctx.db
      .query("knowledgeChunks")
      .withIndex("by_account_source", (q) => q.eq("accountId", accountId))
      .collect();
    for (const chunk of existing) await ctx.db.delete(chunk._id);
    const now = Date.now();
    for (const chunk of chunks)
      await ctx.db.insert("knowledgeChunks", {
        accountId,
        ...chunk,
        active: true,
        createdAt: now,
      });
  },
});

export const byIds = internalQuery({
  args: { ids: v.array(v.id("knowledgeChunks")) },
  handler: async (ctx, { ids }): Promise<Array<Doc<"knowledgeChunks">>> =>
    (await Promise.all(ids.map((id) => ctx.db.get(id)))).filter(
      (chunk): chunk is Doc<"knowledgeChunks"> => chunk !== null,
    ),
});

export const refreshAccount = internalAction({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, { accountId }) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set on the Convex deployment");
    const source = await ctx.runQuery(internal.knowledge.sources, { accountId });
    if (source.length === 0) {
      await ctx.runMutation(internal.knowledge.replace, { accountId, chunks: [] });
      return;
    }
    const vectors = await runTracked(
      ctx,
      {
        accountId,
        stage: "embedding",
        model: EMBEDDING_MODEL,
        promptVersion: PROMPT_VERSIONS.embedding,
        inputIds: source.map((item) => item.sourceId),
      },
      () =>
        Effect.runPromise(
          Effect.flatMap(Embeddings, (embeddings) =>
            embeddings.embed(source.map((item) => item.text)),
          ).pipe(Effect.provide(embeddingsLive(apiKey))),
        ),
      (result) => `${result.length} vetores`,
    );
    await ctx.runMutation(internal.knowledge.replace, {
      accountId,
      chunks: source.map((item, index) => ({
        kind: item.kind,
        sourceId: item.sourceId,
        text: item.text,
        embedding: [...vectors[index]!],
        ...(item.observedAt !== undefined ? { observedAt: item.observedAt } : {}),
      })),
    });
  },
});
