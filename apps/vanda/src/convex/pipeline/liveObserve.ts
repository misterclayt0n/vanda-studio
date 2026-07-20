import type * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import type { RawSignal } from "./domain";
import { fetchAndDecode, type IgConfig, parseTimestamp } from "./igGraph";
import type { SourceAdapter } from "./observe";
import { Signals, type SignalsShape } from "./signals";

// --- Graph response schemas (decoded, not cast) ---------------------------

const IgComment = Schema.Struct({
  id: Schema.String,
  text: Schema.optional(Schema.String),
  timestamp: Schema.optional(Schema.String),
  username: Schema.optional(Schema.String),
});
const IgMediaResponse = Schema.Struct({
  data: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.String,
        caption: Schema.optional(Schema.String),
        media_type: Schema.optional(Schema.String),
        timestamp: Schema.optional(Schema.String),
        permalink: Schema.optional(Schema.String),
        comments: Schema.optional(
          Schema.Struct({ data: Schema.optional(Schema.Array(IgComment)) }),
        ),
      }),
    ),
  ),
});
const IgTagsResponse = Schema.Struct({
  data: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.String,
        caption: Schema.optional(Schema.String),
        permalink: Schema.optional(Schema.String),
        timestamp: Schema.optional(Schema.String),
        username: Schema.optional(Schema.String),
      }),
    ),
  ),
});

/** Recent comments across the account's recent media. */
export interface InstagramObserveOptions {
  readonly accountHandle?: string | undefined;
  readonly syncKind: "backfill" | "reconciliation";
  readonly now?: number | undefined;
}

const BACKFILL_WINDOW_MS = 1000 * 60 * 60 * 24 * 90;

export const igCommentsAdapter = (
  config: IgConfig,
  options: InstagramObserveOptions = { syncKind: "reconciliation" },
): SourceAdapter => ({
  source: "comments",
  fetch: () =>
    fetchAndDecode(
      config,
      "comments",
      `/${config.igUserId}/media`,
      "id,caption,media_type,timestamp,permalink,comments{id,text,timestamp,username}",
      IgMediaResponse,
    ).pipe(
      Effect.map(
        (response): ReadonlyArray<RawSignal> =>
          (response.data ?? []).flatMap((media) => {
            const now = options.now ?? Date.now();
            const mediaPublishedAt = parseTimestamp(media.timestamp);
            return (media.comments?.data ?? [])
              .map((comment): RawSignal => {
                const observedAt = parseTimestamp(comment.timestamp);
                return {
                  source: "comments",
                  externalId: comment.id,
                  text: comment.text?.trim() ?? "",
                  observedAt,
                  ingestedAt: now,
                  syncKind: options.syncKind,
                  mediaExternalId: media.id,
                  mediaCaption: media.caption,
                  mediaType: media.media_type,
                  mediaPublishedAt,
                  authorHandle: comment.username,
                  permalink: media.permalink,
                  isSelf:
                    comment.username !== undefined && options.accountHandle !== undefined
                      ? comment.username.toLocaleLowerCase() ===
                        options.accountHandle.toLocaleLowerCase()
                      : false,
                };
              })
              .filter(
                (signal) =>
                  signal.text.length > 0 &&
                  signal.isSelf !== true &&
                  (options.syncKind !== "backfill" ||
                    now - signal.observedAt <= BACKFILL_WINDOW_MS),
              );
          }),
      ),
    ),
});

/** Media the account is tagged/mentioned in. */
export const igMentionsAdapter = (
  config: IgConfig,
  options: InstagramObserveOptions = { syncKind: "reconciliation" },
): SourceAdapter => ({
  source: "mentions",
  fetch: () =>
    fetchAndDecode(
      config,
      "mentions",
      `/${config.igUserId}/tags`,
      "id,caption,permalink,timestamp,username",
      IgTagsResponse,
    ).pipe(
      Effect.map(
        (response): ReadonlyArray<RawSignal> =>
          (response.data ?? [])
            .map((tag): RawSignal => {
              const now = options.now ?? Date.now();
              return {
                source: "mentions",
                externalId: tag.id,
                text: tag.caption?.trim() ?? "",
                observedAt: parseTimestamp(tag.timestamp),
                ingestedAt: now,
                syncKind: options.syncKind,
                mediaExternalId: tag.id,
                mediaCaption: tag.caption,
                mediaPublishedAt: parseTimestamp(tag.timestamp),
                authorHandle: tag.username,
                permalink: tag.permalink,
                isSelf:
                  tag.username !== undefined && options.accountHandle !== undefined
                    ? tag.username.toLocaleLowerCase() === options.accountHandle.toLocaleLowerCase()
                    : false,
              };
            })
            .filter((signal) => signal.text.length > 0 && signal.isSelf !== true),
      ),
    ),
});

const accountKey = (id: string): Id<"accounts"> => id as Id<"accounts">;

/**
 * `Signals` backed by the Convex action `ctx`. Explicit method return types
 * break the `api ↔ observeNode ↔ liveObserve` import cycle.
 */
export const signalsStoreLive = (ctx: ActionCtx): Layer.Layer<Signals> =>
  Layer.succeed(Signals, {
    insert: (accountId: string, signal: RawSignal): Effect.Effect<boolean, Cause.UnknownError> =>
      Effect.tryPromise(() =>
        ctx.runMutation(internal.observe.insertSignal, {
          accountId: accountKey(accountId),
          source: signal.source,
          externalId: signal.externalId,
          text: signal.text,
          observedAt: signal.observedAt,
          ...(signal.ingestedAt !== undefined ? { ingestedAt: signal.ingestedAt } : {}),
          ...(signal.syncKind !== undefined ? { syncKind: signal.syncKind } : {}),
          ...(signal.mediaExternalId !== undefined
            ? { mediaExternalId: signal.mediaExternalId }
            : {}),
          ...(signal.mediaCaption !== undefined ? { mediaCaption: signal.mediaCaption } : {}),
          ...(signal.mediaType !== undefined ? { mediaType: signal.mediaType } : {}),
          ...(signal.mediaPublishedAt !== undefined
            ? { mediaPublishedAt: signal.mediaPublishedAt }
            : {}),
          ...(signal.isSelf !== undefined ? { isSelf: signal.isSelf } : {}),
          ...(signal.authorHandle !== undefined ? { authorHandle: signal.authorHandle } : {}),
          ...(signal.permalink !== undefined ? { permalink: signal.permalink } : {}),
        }),
      ),
  } satisfies SignalsShape);
