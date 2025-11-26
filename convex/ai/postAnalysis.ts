"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { callLLM, parseJSONResponse } from "./llm";
import {
    SINGLE_POST_ANALYSIS_SYSTEM_PROMPT,
    SINGLE_POST_ANALYSIS_USER_PROMPT,
    SinglePostAnalysisResponse,
} from "./prompts";

// Analyze a single post for context building
export const analyzePost = action({
    args: {
        projectId: v.id("projects"),
        postId: v.id("instagram_posts"),
    },
    handler: async (ctx, args): Promise<{ success: boolean; analysisId: Id<"post_analysis"> }> => {
        // 1. Check authentication
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // 2. Ensure subscription exists
        await ctx.runMutation(api.billing.usage.ensureSubscription, {});

        // 3. Check quota
        const quota = await ctx.runQuery(api.billing.usage.checkQuota, {});
        if (!quota || !quota.hasQuota) {
            throw new Error("No prompts remaining. Please upgrade your plan.");
        }

        // 4. Get project and post data
        const project = await ctx.runQuery(api.projects.get, { projectId: args.projectId });
        if (!project) {
            throw new Error("Project not found or access denied");
        }

        const post = await ctx.runQuery(api.instagramPosts.get, { postId: args.postId });
        if (!post) {
            throw new Error("Post not found");
        }

        // 5. Get latest brand analysis for context (optional)
        const brandAnalysis = await ctx.runQuery(api.ai.analysisMutations.getLatestAnalysis, {
            projectId: args.projectId,
        });

        // 6. Build prompt with brand context if available
        const prompt = SINGLE_POST_ANALYSIS_USER_PROMPT({
            handle: project.instagramHandle || project.name,
            brandVoice: brandAnalysis?.brandVoice?.recommended,
            targetAudience: brandAnalysis?.targetAudience?.recommended,
            post: {
                caption: post.caption,
                mediaType: post.mediaType,
                likeCount: post.likeCount,
                commentsCount: post.commentsCount,
                timestamp: post.timestamp,
            },
        });

        // 7. Call LLM
        const response = await callLLM(
            [
                { role: "system", content: SINGLE_POST_ANALYSIS_SYSTEM_PROMPT },
                { role: "user", content: prompt },
            ],
            { temperature: 0.7, maxTokens: 2048 }
        );

        const analysis = parseJSONResponse<SinglePostAnalysisResponse>(response.content);

        // 8. Store analysis
        const analysisId = await ctx.runMutation(api.ai.analysisMutations.upsertPostAnalysis, {
            projectId: args.projectId,
            postId: args.postId,
            currentCaption: post.caption,
            score: analysis.score,
            analysisDetails: {
                strengths: analysis.strengths,
                weaknesses: analysis.weaknesses,
                engagementPrediction: analysis.engagementPrediction,
                hashtagAnalysis: analysis.hashtagAnalysis,
                toneAnalysis: analysis.toneAnalysis,
            },
            reasoning: analysis.reasoning,
        });

        // 9. Consume prompt
        await ctx.runMutation(api.billing.usage.consumePrompt, { count: 1 });

        return { success: true, analysisId };
    },
});
