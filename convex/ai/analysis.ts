"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { Id, Doc } from "../_generated/dataModel";
import { callLLM, parseJSONResponse } from "./llm";
import {
    BRAND_ANALYSIS_SYSTEM_PROMPT,
    BRAND_ANALYSIS_USER_PROMPT,
    POST_ANALYSIS_SYSTEM_PROMPT,
    POST_ANALYSIS_USER_PROMPT,
    BrandAnalysisResponse,
    PostAnalysisResponse,
} from "./prompts";

// Main action to request a full analysis
export const requestAnalysis = action({
    args: {
        projectId: v.id("projects"),
    },
    handler: async (ctx, args): Promise<{ analysisId: Id<"brand_analysis">; success: boolean }> => {
        // 1. Check authentication
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // 2. Ensure subscription exists (creates free tier if needed)
        await ctx.runMutation(api.billing.usage.ensureSubscription, {});

        // 3. Check quota
        const quota = await ctx.runQuery(api.billing.usage.checkQuota, {});
        if (!quota || !quota.hasQuota) {
            throw new Error("No prompts remaining. Please upgrade your plan.");
        }

        // 4. Get project data
        const project = await ctx.runQuery(api.projects.get, { projectId: args.projectId });
        if (!project) {
            throw new Error("Project not found or access denied");
        }

        // 5. Create analysis record with status "pending"
        const analysisId = await ctx.runMutation(api.ai.analysisMutations.createAnalysis, {
            projectId: args.projectId,
        });

        try {
            // 5. Update status to "processing"
            await ctx.runMutation(api.ai.analysisMutations.updateAnalysisStatus, {
                analysisId,
                status: "processing",
            });

            // 6. Get posts for analysis
            const posts = await ctx.runQuery(api.instagramPosts.listByProject, {
                projectId: args.projectId,
            });

            // 7. Call LLM for brand analysis
            const brandAnalysisPrompt = BRAND_ANALYSIS_USER_PROMPT({
                handle: project.instagramHandle || project.name,
                bio: project.bio,
                followersCount: project.followersCount,
                postsCount: project.postsCount,
                posts: posts.slice(0, 12).map((post: Doc<"instagram_posts">) => ({
                    caption: post.caption,
                    likeCount: post.likeCount,
                    commentsCount: post.commentsCount,
                    mediaType: post.mediaType,
                    timestamp: post.timestamp,
                })),
            });

            const brandResponse = await callLLM(
                [
                    { role: "system", content: BRAND_ANALYSIS_SYSTEM_PROMPT },
                    { role: "user", content: brandAnalysisPrompt },
                ],
                { temperature: 0.7, maxTokens: 2048 }
            );

            const brandAnalysis = parseJSONResponse<BrandAnalysisResponse>(brandResponse.content);

            // 8. Store brand analysis results
            await ctx.runMutation(api.ai.analysisMutations.updateBrandAnalysis, {
                analysisId,
                brandVoice: brandAnalysis.brandVoice,
                contentPillars: brandAnalysis.contentPillars,
                visualDirection: brandAnalysis.visualDirection,
                targetAudience: brandAnalysis.targetAudience,
                overallScore: brandAnalysis.overallScore,
                strategySummary: brandAnalysis.strategySummary,
            });

            // 9. Analyze individual posts (limit to first 12 for cost)
            const postsToAnalyze = posts.slice(0, 12);

            for (const post of postsToAnalyze) {
                try {
                    const postPrompt = POST_ANALYSIS_USER_PROMPT({
                        brandContext: {
                            handle: project.instagramHandle || project.name,
                            brandVoice: brandAnalysis.brandVoice.recommended,
                            targetAudience: brandAnalysis.targetAudience.recommended,
                            contentPillars: brandAnalysis.contentPillars.map((p) => p.name),
                        },
                        post: {
                            caption: post.caption,
                            mediaType: post.mediaType,
                            likeCount: post.likeCount,
                            commentsCount: post.commentsCount,
                            timestamp: post.timestamp,
                        },
                    });

                    const postResponse = await callLLM(
                        [
                            { role: "system", content: POST_ANALYSIS_SYSTEM_PROMPT },
                            { role: "user", content: postPrompt },
                        ],
                        { temperature: 0.7, maxTokens: 2048 }
                    );

                    const postAnalysis = parseJSONResponse<PostAnalysisResponse>(postResponse.content);

                    // Store post analysis
                    await ctx.runMutation(api.ai.analysisMutations.createPostAnalysis, {
                        projectId: args.projectId,
                        analysisId,
                        postId: post._id,
                        currentCaption: post.caption,
                        suggestedCaption: postAnalysis.suggestedCaption,
                        reasoning: postAnalysis.reasoning,
                        score: postAnalysis.score,
                        improvements: postAnalysis.improvements,
                    });
                } catch (postError) {
                    // Log but don't fail the whole analysis if one post fails
                    console.error(`Failed to analyze post ${post._id}:`, postError);
                }
            }

            // 10. Update status to "completed"
            await ctx.runMutation(api.ai.analysisMutations.updateAnalysisStatus, {
                analysisId,
                status: "completed",
            });

            // 11. Consume one prompt from quota
            await ctx.runMutation(api.billing.usage.consumePrompt, { count: 1 });

            return { analysisId, success: true };
        } catch (error) {
            // On failure, update status and store error message
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

            await ctx.runMutation(api.ai.analysisMutations.updateAnalysisStatus, {
                analysisId,
                status: "failed",
                errorMessage,
            });

            throw error;
        }
    },
});

