import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type { BrandCorpus } from "./brand";
import { fetchAndDecode, type IgConfig } from "./igGraph";
import type { SourceFetchFailed } from "./observe";

// --- Graph response schemas (decoded, not cast) ---------------------------

const IgProfile = Schema.Struct({
  username: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  account_type: Schema.optional(Schema.String),
  media_count: Schema.optional(Schema.Number),
  // Available on some account types only; absent decodes cleanly to undefined.
  biography: Schema.optional(Schema.String),
});

const IgCorpusMedia = Schema.Struct({
  data: Schema.optional(
    Schema.Array(
      Schema.Struct({
        caption: Schema.optional(Schema.String),
        comments: Schema.optional(
          Schema.Struct({
            data: Schema.optional(
              Schema.Array(Schema.Struct({ text: Schema.optional(Schema.String) })),
            ),
          }),
        ),
      }),
    ),
  ),
});

/**
 * Assemble the cold-start brand corpus: the profile facts plus the text of recent
 * posts and the comments under them. This is onboarding's read of the account —
 * `proposeBrandProfile` reasons over it. Tagged `"posts"` since it's the
 * account's own content; any fetch/shape failure surfaces as `SourceFetchFailed`.
 */
export const fetchBrandCorpus = (config: IgConfig): Effect.Effect<BrandCorpus, SourceFetchFailed> =>
  Effect.all({
    profile: fetchAndDecode(
      config,
      "posts",
      "/me",
      "username,name,account_type,media_count,biography",
      IgProfile,
    ),
    media: fetchAndDecode(
      config,
      "posts",
      `/${config.igUserId}/media`,
      "caption,comments{text}",
      IgCorpusMedia,
    ),
  }).pipe(
    Effect.map(({ profile, media }): BrandCorpus => {
      const items = media.data ?? [];
      return {
        profile: {
          name: profile.name,
          username: profile.username,
          biography: profile.biography,
          accountType: profile.account_type,
          mediaCount: profile.media_count,
        },
        captions: items.flatMap((m) => (m.caption !== undefined ? [m.caption] : [])),
        comments: items.flatMap((m) =>
          (m.comments?.data ?? []).flatMap((c) => (c.text !== undefined ? [c.text] : [])),
        ),
      };
    }),
  );
