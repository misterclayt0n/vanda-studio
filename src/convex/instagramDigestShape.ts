import { v } from "convex/values";

/** Persisted LLM digest of recent Instagram captions (for AI post generation). */
export const instagramContentDigestValidator = v.object({
    recentThemes: v.array(v.string()),
    recentHooks: v.array(v.string()),
    avoidNext: v.array(v.string()),
    summaryForModel: v.string(),
    postsAnalyzed: v.number(),
    updatedAt: v.number(),
});
