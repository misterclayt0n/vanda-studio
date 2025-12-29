"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { callLLM, parseJSONResponse, generateImage, MODELS } from "./llm";
import {
    ENHANCED_POST_GENERATION_SYSTEM_PROMPT,
    ENHANCED_POST_GENERATION_USER_PROMPT,
    EnhancedPostGenerationResponse,
    IMAGE_GENERATION_PROMPT,
    ImageStyleType,
    PostType,
} from "./prompts";

// Brief input type
const briefValidator = v.object({
    postType: v.string(),
    contentPillar: v.optional(v.string()),
    customTopic: v.optional(v.string()),
    toneOverride: v.optional(v.array(v.string())),
    captionLength: v.optional(v.union(
        v.literal("curta"),
        v.literal("media"),
        v.literal("longa")
    )),
    includeHashtags: v.optional(v.boolean()),
    additionalContext: v.optional(v.string()),
    referenceText: v.optional(v.string()),
});

// Creative angle type
const angleValidator = v.object({
    id: v.string(),
    hook: v.string(),
    approach: v.string(),
    whyItWorks: v.string(),
    exampleOpener: v.string(),
});

// Enhanced post generation with full brief and creative angle
export const generateWithBrief = action({
    args: {
        projectId: v.id("projects"),
        brief: briefValidator,
        selectedAngle: angleValidator,
        imageStyle: v.optional(v.union(
            v.literal("realistic"),
            v.literal("illustrative"),
            v.literal("minimalist"),
            v.literal("artistic")
        )),
    },
    handler: async (ctx, args): Promise<{
        success: boolean;
        generatedPostId: Id<"generated_posts">;
    }> => {
        // 1. Check authentication
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // 2. Ensure subscription exists
        await ctx.runMutation(api.billing.usage.ensureSubscription, {});

        // 3. Check quota (need 2 prompts: 1 for caption, 1 for image)
        const quota = await ctx.runQuery(api.billing.usage.checkQuota, {});
        if (!quota || quota.remaining < 2) {
            throw new Error(
                `Saldo insuficiente. Voce precisa de 2 creditos para gerar um post. Creditos restantes: ${quota?.remaining ?? 0}`
            );
        }

        // 4. Get project data
        const project = await ctx.runQuery(api.projects.get, { projectId: args.projectId });
        if (!project) {
            throw new Error("Project not found or access denied");
        }

        // 5. Get brand analysis - required
        const brandAnalysis = await ctx.runQuery(api.ai.analysisMutations.getLatestAnalysis, {
            projectId: args.projectId,
        });

        if (!brandAnalysis || brandAnalysis.status !== "completed") {
            throw new Error("Analise de marca necessaria. Execute a analise primeiro.");
        }

        if (!brandAnalysis.brandVoice || !brandAnalysis.targetAudience || !brandAnalysis.contentPillars) {
            throw new Error("Analise de marca incompleta. Execute novamente.");
        }

        // 6. Get analyzed posts for reference (optional)
        const postAnalyses = await ctx.runQuery(api.ai.analysisMutations.listPostAnalyses, {
            projectId: args.projectId,
        });

        const analyzedPosts = postAnalyses?.filter((a) => a.hasAnalysis && a.analysisDetails) ?? [];

        // Get source post details
        const sourcePosts = await Promise.all(
            analyzedPosts.slice(0, 5).map(async (analysis) => {
                const post = await ctx.runQuery(api.instagramPosts.get, { postId: analysis.postId });

                let imageUrl: string | null = null;
                if (post?.mediaStorageId) {
                    imageUrl = await ctx.storage.getUrl(post.mediaStorageId);
                } else if (post?.mediaUrl) {
                    imageUrl = post.mediaUrl;
                }

                return {
                    postId: analysis.postId,
                    caption: post?.caption || analysis.currentCaption || "",
                    strengths: analysis.analysisDetails?.strengths ?? [],
                    toneAnalysis: analysis.analysisDetails?.toneAnalysis ?? "",
                    engagementScore: post?.engagementScore ?? 0.5,
                    imageUrl,
                };
            })
        );

        // 7. Get reference images analysis (if any)
        const referenceImages = await ctx.runQuery(api.referenceImages.listByProject, {
            projectId: args.projectId,
        });

        const referenceImagesAnalysis = referenceImages
            .filter((img) => img.analysis)
            .map((img) => ({
                description: img.analysis!.description,
                elements: img.analysis!.elements,
            }));

        // 8. Build enhanced context
        const enhancedContext = {
            brandName: project.name,
            brandVoice: {
                recommended: brandAnalysis.brandVoice.recommended,
                tone: brandAnalysis.brandVoice.tone,
            },
            targetAudience: brandAnalysis.targetAudience.recommended,
            contentPillars: brandAnalysis.contentPillars.map((p) => ({
                name: p.name,
                description: p.description,
            })),
            // Ensure visualIdentity conforms to the expected type
            visualIdentity: brandAnalysis.visualIdentity ? {
                colorPalette: brandAnalysis.visualIdentity.colorPalette,
                layoutPatterns: brandAnalysis.visualIdentity.layoutPatterns,
                photographyStyle: brandAnalysis.visualIdentity.photographyStyle,
                graphicElements: brandAnalysis.visualIdentity.graphicElements,
                filterTreatment: brandAnalysis.visualIdentity.filterTreatment,
                dominantColors: brandAnalysis.visualIdentity.dominantColors ?? [],
                consistencyScore: brandAnalysis.visualIdentity.consistencyScore ?? 0,
            } : undefined,
            // Brief
            postType: args.brief.postType as PostType,
            selectedPillar: args.brief.contentPillar,
            customTopic: args.brief.customTopic,
            toneOverride: args.brief.toneOverride,
            captionLength: args.brief.captionLength as "curta" | "media" | "longa" | undefined,
            includeHashtags: args.brief.includeHashtags,
            referenceText: args.brief.referenceText,
            additionalContext: args.brief.additionalContext,
            // Reference images
            referenceImagesAnalysis: referenceImagesAnalysis.length > 0 ? referenceImagesAnalysis : undefined,
            // Selected angle
            selectedAngle: {
                hook: args.selectedAngle.hook,
                approach: args.selectedAngle.approach,
                exampleOpener: args.selectedAngle.exampleOpener,
            },
            // Relevant posts
            relevantPosts: sourcePosts.slice(0, 3).map((p) => ({
                caption: p.caption,
                strengths: p.strengths,
                toneAnalysis: p.toneAnalysis,
                engagementScore: p.engagementScore,
            })),
        };

        // 9. Generate caption with enhanced prompt
        const prompt = ENHANCED_POST_GENERATION_USER_PROMPT(enhancedContext);
        const response = await callLLM(
            [
                { role: "system", content: ENHANCED_POST_GENERATION_SYSTEM_PROMPT },
                { role: "user", content: prompt },
            ],
            {
                model: MODELS.GPT_4_1,
                temperature: 0.8,
                maxTokens: 1024,
            }
        );

        const generated = parseJSONResponse<EnhancedPostGenerationResponse>(response.content);

        // 10. Generate image
        const referenceImageUrls = sourcePosts
            .filter((p) => p.imageUrl !== null)
            .map((p) => ({ url: p.imageUrl as string }));

        const imagePrompt = IMAGE_GENERATION_PROMPT({
            brandName: project.name,
            visualStyle: brandAnalysis.visualDirection?.recommendedStyle ?? "Moderno e profissional",
            caption: generated.caption,
            additionalContext: args.brief.additionalContext,
            imageStyle: args.imageStyle as ImageStyleType | undefined,
            hasReferenceImages: referenceImageUrls.length > 0,
            businessCategory: brandAnalysis.businessCategory,
            postType: args.brief.postType as PostType,
        });

        let imageStorageId: Id<"_storage"> | undefined;
        try {
            const imageResult = await generateImage(imagePrompt, {
                referenceImages: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
            });

            const binaryData = Uint8Array.from(atob(imageResult.imageBase64), (c) => c.charCodeAt(0));
            const blob = new Blob([binaryData], { type: imageResult.mimeType });
            imageStorageId = await ctx.storage.store(blob);
        } catch (imageError) {
            console.error("Image generation failed:", imageError);
        }

        // 11. Store generated post with full brief and angle
        const generatedPostId = await ctx.runMutation(api.generatedPosts.create, {
            projectId: args.projectId,
            caption: generated.caption,
            brandAnalysisId: brandAnalysis._id,
            sourcePostIds: sourcePosts.map((p) => p.postId),
            reasoning: generated.reasoning,
            model: MODELS.GPT_4_1,
            imageStorageId,
            imagePrompt: imageStorageId ? imagePrompt : undefined,
            imageModel: imageStorageId ? MODELS.GEMINI_3_PRO_IMAGE : undefined,
            brief: {
                postType: args.brief.postType,
                contentPillar: args.brief.contentPillar,
                customTopic: args.brief.customTopic,
                toneOverride: args.brief.toneOverride,
                captionLength: args.brief.captionLength,
                includeHashtags: args.brief.includeHashtags,
                additionalContext: args.brief.additionalContext,
                referenceText: args.brief.referenceText,
            },
            selectedAngle: {
                hook: args.selectedAngle.hook,
                approach: args.selectedAngle.approach,
                whyItWorks: args.selectedAngle.whyItWorks,
            },
        });

        // 12. Consume prompts
        await ctx.runMutation(api.billing.usage.consumePrompt, { count: imageStorageId ? 2 : 1 });

        return { success: true, generatedPostId };
    },
});
