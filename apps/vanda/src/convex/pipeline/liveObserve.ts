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
export const igCommentsAdapter = (config: IgConfig): SourceAdapter => ({
  source: "comments",
  fetch: () =>
    fetchAndDecode(
      config,
      "comments",
      `/${config.igUserId}/media`,
      "permalink,comments{id,text,timestamp,username}",
      IgMediaResponse,
    ).pipe(
      Effect.map(
        (response): ReadonlyArray<RawSignal> =>
          (response.data ?? []).flatMap((media) =>
            (media.comments?.data ?? []).map((comment) => ({
              source: "comments",
              externalId: comment.id,
              text: comment.text ?? "",
              observedAt: parseTimestamp(comment.timestamp),
              authorHandle: comment.username,
              permalink: media.permalink,
            })),
          ),
      ),
    ),
});

/** Media the account is tagged/mentioned in. */
export const igMentionsAdapter = (config: IgConfig): SourceAdapter => ({
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
          (response.data ?? []).map((tag) => ({
            source: "mentions",
            externalId: tag.id,
            text: tag.caption ?? "",
            observedAt: parseTimestamp(tag.timestamp),
            authorHandle: tag.username,
            permalink: tag.permalink,
          })),
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
          ...(signal.authorHandle !== undefined ? { authorHandle: signal.authorHandle } : {}),
          ...(signal.permalink !== undefined ? { permalink: signal.permalink } : {}),
        }),
      ),
  } satisfies SignalsShape);
