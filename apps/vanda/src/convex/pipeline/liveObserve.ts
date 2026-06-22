import type * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import type { RawSignal, SignalSource } from "./domain";
import { type SourceAdapter, SourceFetchFailed } from "./observe";
import { Signals, type SignalsShape } from "./signals";

const GRAPH_BASE = "https://graph.instagram.com/v23.0";

interface IgConfig {
  readonly igUserId: string;
  readonly token: string;
}

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

const parseTimestamp = (timestamp: string | undefined): number => {
  if (timestamp === undefined) return Date.now();
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? Date.now() : parsed;
};

const graphFetch = (config: IgConfig, path: string, fields: string): Promise<unknown> => {
  const query = new URLSearchParams({ fields, limit: "25", access_token: config.token });
  return fetch(`${GRAPH_BASE}${path}?${query.toString()}`).then(async (response) => {
    if (!response.ok) throw new Error(`graph ${path} -> HTTP ${response.status}`);
    return response.json();
  });
};

const fetchAndDecode = <A>(
  config: IgConfig,
  source: SignalSource,
  path: string,
  fields: string,
  schema: Schema.Codec<A, unknown>,
): Effect.Effect<A, SourceFetchFailed> =>
  Effect.tryPromise({
    try: () => graphFetch(config, path, fields),
    catch: (error) =>
      new SourceFetchFailed({
        source,
        message: error instanceof Error ? error.message : String(error),
      }),
  }).pipe(
    Effect.flatMap((json) =>
      Schema.decodeUnknownEffect(schema)(json).pipe(
        Effect.mapError(
          (error) => new SourceFetchFailed({ source, message: `decode failed: ${error}` }),
        ),
      ),
    ),
  );

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
