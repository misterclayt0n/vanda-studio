'use node';

import { ApifyClient } from "apify-client";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

const DEFAULT_ACTOR_ID = "shu8hvrXbJbY3Eb9W";

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type RawInstagramItem = Record<string, any>;

type InstagramPostRecord = {
    instagramId: string;
    caption?: string;
    mediaUrl: string;
    mediaType: string;
    permalink: string;
    timestamp: string;
    likeCount?: number;
    commentsCount?: number;
};

export const fetchProfile = action({
    args: {
        projectId: v.id("projects"),
        instagramUrl: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Must be signed in to fetch Instagram data");
        }

        const token = process.env.APIFY_API_TOKEN ?? process.env.APIFY_TOKEN;
        if (!token) {
            throw new Error("Missing Apify token (set APIFY_TOKEN or APIFY_API_TOKEN)");
        }

        const client = new ApifyClient({ token });
        const normalizedUrl = normalizeInstagramUrl(args.instagramUrl);
        const actorId = process.env.APIFY_INSTAGRAM_ACTOR_ID ?? DEFAULT_ACTOR_ID;

        const run = await client.actor(actorId).call({
            directUrls: [normalizedUrl],
            resultsType: "posts",
            resultsLimit: 200,
            addParentData: true,
            searchType: "user",
        });

        if (!run.defaultDatasetId) {
            throw new Error("Apify run did not return a dataset");
        }

        const { items } = await client.dataset(run.defaultDatasetId).listItems({ clean: true });
        const datasetItems = (items as RawInstagramItem[]) ?? [];

        if (datasetItems.length === 0) {
            throw new Error("Apify did not return any Instagram data");
        }

        const profile = buildProfileFromItems(datasetItems, normalizedUrl);
        const posts = buildPostsFromItems(datasetItems, normalizedUrl);

        await ctx.runMutation(api.projects.updateProfileData, {
            projectId: args.projectId,
            ...profile,
        });

        if (posts.length > 0) {
            await ctx.runMutation(api.instagramPosts.replaceForProject, {
                projectId: args.projectId,
                posts,
            });
        }

        return {
            profile,
            postsInserted: posts.length,
        };
    },
});

function normalizeInstagramUrl(rawUrl: string): string {
    const trimmed = rawUrl.trim();

    const formatHandle = (value: string) => value.replace(/^@/, "").split(/[/?]/)[0] ?? "";

    if (!trimmed.startsWith("http")) {
        const handle = formatHandle(trimmed);
        return handle ? `https://www.instagram.com/${handle}/` : "https://www.instagram.com/";
    }

    try {
        const url = new URL(trimmed);
        const [handle] = url.pathname.split("/").filter(Boolean);
        return handle ? `https://www.instagram.com/${handle}/` : "https://www.instagram.com/";
    } catch {
        const handle = formatHandle(trimmed);
        return handle ? `https://www.instagram.com/${handle}/` : "https://www.instagram.com/";
    }
}

function buildProfileFromItems(items: RawInstagramItem[], fallbackUrl: string) {
    const first = items[0] ?? {};
    const owner = first.owner ?? first.ownerObject ?? {};

    const instagramHandle =
        coalesce<string>(
            first.ownerUsername,
            owner.username,
            extractHandleFromUrl(fallbackUrl),
        ) ?? undefined;

    const followers = coalesce<number>(
        owner.followersCount,
        owner.followedBy,
        owner.followedByCount,
        first.ownerFollowers,
        first.followersCount,
        first.ownerFollowerCount,
    );

    const following = coalesce<number>(
        owner.followsCount,
        owner.follows,
        first.ownerFollowing,
        first.followingCount,
    );

    const postsCount = coalesce<number>(
        owner.postsCount,
        first.ownerPostsCount,
        first.postsCount,
    );

    return {
        instagramHandle,
        profilePictureUrl: coalesce<string>(
            owner.profilePicUrl,
            owner.profilePictureUrl,
            first.ownerProfilePicUrl,
            first.profilePicUrl,
        ),
        bio: coalesce<string>(owner.biography, first.ownerBiography, first.biography),
        followersCount: followers,
        followingCount: following,
        postsCount: postsCount ?? items.length,
        website: coalesce<string>(
            owner.externalUrl,
            owner.website,
            first.ownerExternalUrl,
            first.externalUrl,
        ),
    };
}

function buildPostsFromItems(items: RawInstagramItem[], fallbackUrl: string): InstagramPostRecord[] {
    const now = Date.now();

    return items
        .map((item, index) => {
            const mediaUrl = coalesce<string>(
                item.displayUrl,
                item.imageUrl,
                item.videoUrl,
                item.thumbnailUrl,
            );

            if (!mediaUrl) {
                return null;
            }

            const instagramId =
                coalesce<string>(
                    item.id,
                    item.postId,
                    item.instagramId,
                    item.shortCode,
                ) ?? `post_${now}_${index}`;

            const permalink =
                coalesce<string>(
                    item.permalink,
                    item.url,
                    item.link,
                    item.shortCode ? `https://www.instagram.com/p/${item.shortCode}/` : undefined,
                ) ?? fallbackUrl;

            return {
                instagramId,
                caption: coalesce<string>(item.caption, item.description, item.title),
                mediaUrl,
                mediaType:
                    coalesce<string>(
                        item.mediaType,
                        item.type,
                        item.isVideo ? "VIDEO" : undefined,
                    ) ?? "IMAGE",
                permalink,
                timestamp: normalizeTimestamp(
                    item.timestamp ?? item.takenAt ?? item.publishedAt ?? item.createdAt,
                ),
                likeCount: coalesce<number>(
                    item.likesCount,
                    item.likeCount,
                    item.edge_liked_by?.count,
                ),
                commentsCount: coalesce<number>(
                    item.commentsCount,
                    item.commentCount,
                    item.edge_media_to_comment?.count,
                ),
            };
        })
        .filter((post): post is InstagramPostRecord => Boolean(post));
}

function normalizeTimestamp(value: unknown): string {
    if (typeof value === "number") {
        return new Date(value > 1e12 ? value : value * 1000).toISOString();
    }

    if (typeof value === "string" && value.trim().length > 0) {
        const numericValue = Number(value);
        if (!Number.isNaN(numericValue)) {
            return new Date(numericValue > 1e12 ? numericValue : numericValue * 1000).toISOString();
        }

        const parsed = new Date(value);
        if (!Number.isNaN(parsed.valueOf())) {
            return parsed.toISOString();
        }
    }

    return new Date().toISOString();
}

function extractHandleFromUrl(url: string): string | undefined {
    try {
        const parsed = new URL(url);
        const [handle] = parsed.pathname.split("/").filter(Boolean);
        return handle;
    } catch {
        const cleaned = url.replace(/^https?:\/\//, "");
        return cleaned.split("/").filter(Boolean)[0];
    }
}

function coalesce<T>(...values: (T | null | undefined)[]): T | undefined {
    for (const value of values) {
        if (value !== undefined && value !== null) {
            return value;
        }
    }
    return undefined;
}
