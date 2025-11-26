"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { callLLM, parseJSONResponse, generateImage, MODELS } from "./llm";
import {
    POST_GENERATION_SYSTEM_PROMPT,
    POST_GENERATION_USER_PROMPT,
    PostGenerationResponse,
    IMAGE_GENERATION_PROMPT,
    ImageStyleType,
} from "./prompts";

// Generate a new post based on brand context and analyzed posts
export const generatePost = action({
    args: {
        projectId: v.id("projects"),
        additionalContext: v.optional(v.string()),
        imageStyle: v.optional(v.union(
            v.literal("realistic"),
            v.literal("illustrative"),
            v.literal("minimalist"),
            v.literal("artistic")
        )),
    },
    handler: async (ctx, args): Promise<{ success: boolean; generatedPostId: Id<"generated_posts"> }> => {
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
            throw new Error(`Saldo insuficiente. Voce precisa de 2 creditos para gerar um post (legenda + imagem). Creditos restantes: ${quota?.remaining ?? 0}`);
        }

        // 4. Get project data
        const project = await ctx.runQuery(api.projects.get, { projectId: args.projectId });
        if (!project) {
            throw new Error("Project not found or access denied");
        }

        // 5. Get brand analysis - required for generation
        const brandAnalysis = await ctx.runQuery(api.ai.analysisMutations.getLatestAnalysis, {
            projectId: args.projectId,
        });

        if (!brandAnalysis || brandAnalysis.status !== "completed") {
            throw new Error("Brand analysis required. Run brand analysis first.");
        }

        if (!brandAnalysis.brandVoice || !brandAnalysis.targetAudience || !brandAnalysis.contentPillars) {
            throw new Error("Incomplete brand analysis. Please run brand analysis again.");
        }

        // 6. Get analyzed posts - need at least 3
        const postAnalyses = await ctx.runQuery(api.ai.analysisMutations.listPostAnalyses, {
            projectId: args.projectId,
        });

        const analyzedPosts = postAnalyses?.filter((a) => a.hasAnalysis && a.analysisDetails) ?? [];

        if (analyzedPosts.length < 3) {
            throw new Error(`Need at least 3 analyzed posts for context. Currently have ${analyzedPosts.length}.`);
        }

        // 7. Get source post IDs and their captions
        const sourcePosts = await Promise.all(
            analyzedPosts.slice(0, 5).map(async (analysis) => {
                const post = await ctx.runQuery(api.instagramPosts.get, { postId: analysis.postId });
                return {
                    postId: analysis.postId,
                    caption: post?.caption || analysis.currentCaption || "",
                    strengths: analysis.analysisDetails?.strengths ?? [],
                    toneAnalysis: analysis.analysisDetails?.toneAnalysis ?? "",
                };
            })
        );

        // 8. Build context for generation
        const context = {
            brandVoice: {
                recommended: brandAnalysis.brandVoice.recommended,
                tone: brandAnalysis.brandVoice.tone,
            },
            targetAudience: brandAnalysis.targetAudience.recommended,
            contentPillars: brandAnalysis.contentPillars.map((p) => ({
                name: p.name,
                description: p.description,
            })),
            analyzedPosts: sourcePosts.map((p) => ({
                caption: p.caption,
                strengths: p.strengths,
                toneAnalysis: p.toneAnalysis,
            })),
            additionalContext: args.additionalContext,
        };

        // 9. Call LLM - Using GPT-4.1 for high-quality caption generation
        const prompt = POST_GENERATION_USER_PROMPT(context);
        const response = await callLLM(
            [
                { role: "system", content: POST_GENERATION_SYSTEM_PROMPT },
                { role: "user", content: prompt },
            ],
            {
                model: MODELS.GPT_4_1,
                temperature: 0.8,
                maxTokens: 1024
            }
        );

        const generated = parseJSONResponse<PostGenerationResponse>(response.content);

        // 10. Generate image for the post
        const imagePrompt = IMAGE_GENERATION_PROMPT({
            brandName: project.name,
            visualStyle: brandAnalysis.visualDirection?.recommendedStyle ?? "Moderno e profissional",
            caption: generated.caption,
            additionalContext: args.additionalContext,
            imageStyle: args.imageStyle as ImageStyleType | undefined,
        });

        let imageStorageId: Id<"_storage"> | undefined;
        try {
            const imageResult = await generateImage(imagePrompt);

            // Convert base64 to blob and store in Convex
            const binaryData = Uint8Array.from(atob(imageResult.imageBase64), c => c.charCodeAt(0));
            const blob = new Blob([binaryData], { type: imageResult.mimeType });
            imageStorageId = await ctx.storage.store(blob);
        } catch (imageError) {
            // Log but don't fail the whole generation if image fails
            console.error("Image generation failed:", imageError);
        }

        // 11. Store generated post
        const generatedPostId = await ctx.runMutation(api.generatedPosts.create, {
            projectId: args.projectId,
            caption: generated.caption,
            additionalContext: args.additionalContext,
            brandAnalysisId: brandAnalysis._id,
            sourcePostIds: sourcePosts.map((p) => p.postId),
            reasoning: generated.reasoning,
            model: MODELS.GPT_4_1,
            imageStorageId,
            imagePrompt: imageStorageId ? imagePrompt : undefined,
            imageModel: imageStorageId ? MODELS.GEMINI_3_PRO_IMAGE : undefined,
        });

        // 12. Consume prompt (2 prompts: 1 for caption, 1 for image)
        await ctx.runMutation(api.billing.usage.consumePrompt, { count: imageStorageId ? 2 : 1 });

        return { success: true, generatedPostId };
    },
});

// Regenerate an existing post
export const regeneratePost = action({
    args: {
        generatedPostId: v.id("generated_posts"),
        additionalContext: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<{ success: boolean }> => {
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

        // 4. Get the existing generated post to get project context
        const existingPost = await ctx.runQuery(api.generatedPosts.listByProject, {
            projectId: args.generatedPostId as unknown as Id<"projects">, // Will fail, need to add a get query
        });

        // For now, we'll get the data via the mutation which has access to the post
        // This is a simplified regeneration that just generates a new caption

        // Get the generated post first (need to add a get query)
        // For now, throw an error until we add the proper query
        throw new Error("Regeneration not yet implemented. Please create a new post.");
    },
});
