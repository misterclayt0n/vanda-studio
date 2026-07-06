"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, type ActionCtx } from "./_generated/server";
import { decryptInstagramToken } from "./instagramToken";

type JsonObject = Record<string, unknown>;

type WebhookConnection = {
  accountId: Id<"accounts">;
  igUserId: string;
  tokenCiphertext: string | undefined;
  tokenIv: string | undefined;
  tokenAuthTag: string | undefined;
};

const GRAPH_BASE = "https://graph.instagram.com/v23.0";

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const string = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const number = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const entryObservedAt = (entry: JsonObject): number => {
  const seconds = number(entry.time);
  return seconds === undefined ? Date.now() : seconds * 1000;
};

const graphGet = async (
  token: string,
  path: string,
  fields: string,
): Promise<JsonObject | null> => {
  const query = new URLSearchParams({ fields, access_token: token });
  const response = await fetch(`${GRAPH_BASE}${path}?${query.toString()}`);
  if (!response.ok) return null;
  const json = (await response.json()) as unknown;
  return isObject(json) ? json : null;
};

const permalinkForMedia = async (token: string, mediaId: string): Promise<string | undefined> => {
  const media = await graphGet(token, `/${mediaId}`, "permalink");
  return media === null ? undefined : string(media.permalink);
};

const tokenFor = (connection: WebhookConnection): string | null => {
  try {
    return decryptInstagramToken(connection);
  } catch {
    return null;
  }
};

const insertSignal = async (
  ctx: ActionCtx,
  signal: {
    accountId: Id<"accounts">;
    source: "comments" | "mentions";
    externalId: string;
    text: string;
    observedAt: number;
    authorHandle?: string;
    permalink?: string;
  },
): Promise<void> => {
  await ctx.runMutation(internal.instagramWebhook.insertWebhookSignal, signal);
};

const handleComment = async (
  ctx: ActionCtx,
  connection: WebhookConnection,
  value: JsonObject,
  observedAt: number,
): Promise<void> => {
  const id = string(value.id);
  if (id === undefined) return;

  const from = isObject(value.from) ? value.from : {};
  const media = isObject(value.media) ? value.media : {};
  const token = tokenFor(connection);
  const mediaId = string(media.id);
  const authorHandle = string(from.username);
  const permalink =
    token === null || mediaId === undefined ? undefined : await permalinkForMedia(token, mediaId);

  await insertSignal(ctx, {
    accountId: connection.accountId,
    source: "comments",
    externalId: id,
    text: string(value.text) ?? "",
    observedAt,
    ...(authorHandle !== undefined ? { authorHandle } : {}),
    ...(permalink !== undefined ? { permalink } : {}),
  });
};

const handleMention = async (
  ctx: ActionCtx,
  connection: WebhookConnection,
  value: JsonObject,
  observedAt: number,
): Promise<void> => {
  const token = tokenFor(connection);
  const commentId = string(value.comment_id);
  const mediaId = string(value.media_id);

  if (commentId !== undefined) {
    const comment = token === null ? null : await graphGet(token, `/${commentId}`, "id,text,timestamp,username");
    const authorHandle = string(comment?.username);
    const permalink =
      token === null || mediaId === undefined ? undefined : await permalinkForMedia(token, mediaId);
    await insertSignal(ctx, {
      accountId: connection.accountId,
      source: "mentions",
      externalId: commentId,
      text: string(comment?.text) ?? "@menção em comentário",
      observedAt: Date.parse(string(comment?.timestamp) ?? "") || observedAt,
      ...(authorHandle !== undefined ? { authorHandle } : {}),
      ...(permalink !== undefined ? { permalink } : {}),
    });
    return;
  }

  if (mediaId !== undefined) {
    const media = token === null ? null : await graphGet(token, `/${mediaId}`, "id,caption,permalink,timestamp,username");
    const authorHandle = string(media?.username);
    const permalink = string(media?.permalink);
    await insertSignal(ctx, {
      accountId: connection.accountId,
      source: "mentions",
      externalId: mediaId,
      text: string(media?.caption) ?? "@menção em mídia",
      observedAt: Date.parse(string(media?.timestamp) ?? "") || observedAt,
      ...(authorHandle !== undefined ? { authorHandle } : {}),
      ...(permalink !== undefined ? { permalink } : {}),
    });
  }
};

/** Process verified Instagram webhook payloads into the same `signals` table the cron poller writes. */
export const process = internalAction({
  args: { payload: v.any() },
  handler: async (ctx, { payload }) => {
    if (!isObject(payload)) return;
    const entries = Array.isArray(payload.entry) ? payload.entry : [];

    for (const rawEntry of entries) {
      if (!isObject(rawEntry)) continue;
      const externalAccountId = string(rawEntry.id);
      if (externalAccountId === undefined) continue;

      const connection = await ctx.runQuery(internal.instagramWebhook.accountConnectionByExternalId, {
        externalAccountId,
      });
      if (connection === null) continue;

      const changes = Array.isArray(rawEntry.changes) ? rawEntry.changes : [];
      for (const rawChange of changes) {
        if (!isObject(rawChange)) continue;
        const field = string(rawChange.field);
        const value = isObject(rawChange.value) ? rawChange.value : null;
        if (value === null) continue;

        if (field === "comments") await handleComment(ctx, connection, value, entryObservedAt(rawEntry));
        if (field === "mentions") await handleMention(ctx, connection, value, entryObservedAt(rawEntry));
      }
    }
  },
});
