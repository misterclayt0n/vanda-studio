"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import type { Id, Doc } from "../_generated/dataModel";
import { callLLM, callVisionLLM, parseJSONResponse } from "./llm";
import {
    BRAND_ANALYSIS_SYSTEM_PROMPT,
    BRAND_ANALYSIS_USER_PROMPT,
    VISUAL_IDENTITY_SYSTEM_PROMPT,
    VISUAL_IDENTITY_USER_PROMPT,
} from "./prompts";
import type {
    BrandAnalysisResponse,
    VisualIdentityResponse,
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

            // 8. Extract visual identity from actual post images using vision LLM
            let visualIdentity: VisualIdentityResponse | undefined;
            
            // Get image URLs for top posts (prefer high-engagement posts)
            const postsWithImages = posts
                .filter((p: Doc<"instagram_posts"> & { mediaStorageUrl?: string | null }) => 
                    p.mediaType !== "VIDEO" && (p.mediaStorageUrl || p.mediaUrl)
                )
                .sort((a: Doc<"instagram_posts">, b: Doc<"instagram_posts">) => 
                    (b.likeCount || 0) - (a.likeCount || 0)
                )
                .slice(0, 8); // Take top 8 for visual analysis

            if (postsWithImages.length >= 3) {
                try {
                    const imageUrls = postsWithImages.map(
                        (p: Doc<"instagram_posts"> & { mediaStorageUrl?: string | null }) => 
                            p.mediaStorageUrl || p.mediaUrl
                    );

                    const visionPrompt = `${VISUAL_IDENTITY_SYSTEM_PROMPT}\n\n${VISUAL_IDENTITY_USER_PROMPT(
                        project.instagramHandle || project.name,
                        imageUrls.length
                    )}`;

                    const visionResponse = await callVisionLLM(
                        visionPrompt,
                        imageUrls,
                        { temperature: 0.5, jsonMode: true }
                    );

                    visualIdentity = parseJSONResponse<VisualIdentityResponse>(visionResponse.content);
                    console.log("[ANALYSIS] Visual identity extracted:", visualIdentity.summary);
                } catch (visionError) {
                    console.error("[ANALYSIS] Failed to extract visual identity:", visionError);
                    // Continue without visual identity - it's optional
                }
            } else {
                console.log("[ANALYSIS] Not enough image posts for visual identity analysis");
            }

            // 9. Store brand analysis results (including visual identity)
            await ctx.runMutation(api.ai.analysisMutations.updateBrandAnalysis, {
                analysisId,
                brandVoice: brandAnalysis.brandVoice,
                contentPillars: brandAnalysis.contentPillars,
                visualDirection: brandAnalysis.visualDirection,
                targetAudience: brandAnalysis.targetAudience,
                overallScore: brandAnalysis.overallScore,
                strategySummary: brandAnalysis.strategySummary,
                // NEW: Visual identity from vision LLM
                visualIdentity: visualIdentity ? {
                    colorPalette: visualIdentity.colorPalette,
                    layoutPatterns: visualIdentity.layoutPatterns,
                    photographyStyle: visualIdentity.photographyStyle,
                    graphicElements: visualIdentity.graphicElements,
                    filterTreatment: visualIdentity.filterTreatment,
                    dominantColors: visualIdentity.dominantColors,
                    consistencyScore: visualIdentity.consistencyScore,
                } : undefined,
            });

            // Post analysis is now done on-demand per post, not in batch
            // See postAnalysis.ts for analyzePost action

            // 9. Update status to "completed"
            await ctx.runMutation(api.ai.analysisMutations.updateAnalysisStatus, {
                analysisId,
                status: "completed",
            });

            // 10. Consume one prompt from quota
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

