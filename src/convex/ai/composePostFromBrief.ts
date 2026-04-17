"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { refundAiUsage, reserveAiUsage } from "../billing/autumnUsage";
import { coerceImageGenerationSettings } from "../../lib/studio/imageGenerationCapabilities";
import {
    estimateCaptionUsage,
    estimateImageBatchUsage,
    estimateImageLineItem,
    sumUsageLineItemCredits,
} from "../../lib/billing/aiCredits";
import { projectContextValidator } from "./projectContextValidator";
import {
    buildCarouselSlideVisionPrompt,
    getPostTemplateById,
    getPostTemplateReferenceFiles,
    getTemplateReferencePublicUrl,
} from "../../lib/data/postTemplates";
import { persistSingleGeneratedImage } from "./imageGenerationPersist";
import { splitPostBriefIntoSlidePrompts } from "./postSlidePrompts";
import { generateCaption } from "./agents/index";
import {
    DEFAULT_CAPTION_MODEL,
    DEFAULT_IMAGE_MODEL,
    type AspectRatio,
    type Resolution,
} from "./llm/index";

function publicAppOriginForTemplates(): string {
    const raw =
        process.env.PUBLIC_APP_URL?.trim() ||
        process.env.SITE_URL?.trim() ||
        "https://vanda.studio";
    return raw.replace(/\/$/, "");
}

const MODEL_DISPLAY: Record<string, string> = {
    "google/gemini-2.5-flash-image": "Nano Banana",
    "google/gemini-3.1-flash-image-preview": "Nano Banana 2",
    "google/gemini-3-pro-image-preview": "Nano Banana Pro",
    "bytedance-seed/seedream-4.5": "SeeDream v4.5",
    "black-forest-labs/flux.2-flex": "Flux 2 Flex",
    "openai/gpt-5-image": "GPT Image 1.5",
};

function buildReferenceTextFromSlides(slidePrompts: string[], imageModel: string): string {
    const modelLabel = MODEL_DISPLAY[imageModel] ?? imageModel;
    return slidePrompts
        .map((prompt, index) =>
            [
                `Imagem ${index + 1}`,
                `Origem: Gerada`,
                `Modelo: ${modelLabel}`,
                prompt ? `Prompt: ${prompt}` : null,
            ]
                .filter(Boolean)
                .join("\n")
        )
        .join("\n\n");
}

export const composeFromBrief = action({
    args: {
        brief: v.string(),
        templateId: v.optional(v.string()),
        imageModel: v.optional(v.string()),
        aspectRatio: v.optional(v.string()),
        resolution: v.optional(v.string()),
        captionModel: v.optional(v.string()),
        projectId: v.optional(v.id("projects")),
        projectContext: projectContextValidator,
        stylePreset: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<{
        mediaItemIds: Id<"media_items">[];
        caption: string;
        explanation: string;
        creditsUsed: number;
        captionFailed?: boolean;
        captionError?: string;
        captionFallbackUsed?: boolean;
        captionModelRequested?: string;
        captionModelUsed?: string;
    }> => {
        try {
            const identity = await ctx.auth.getUserIdentity();
            if (!identity) {
                throw new Error("Você precisa estar autenticado");
            }

            const user = await ctx.runMutation(api.users.ensureCurrent, {});

            if (args.projectId) {
                const project = await ctx.runQuery(api.projects.get, {
                    projectId: args.projectId,
                });
                if (!project) {
                    throw new Error("Projeto não encontrado");
                }
            }

            const brief = args.brief.trim();
            if (!brief) {
                throw new Error("Escreva um brief para gerar o post");
            }

            const imageModel = args.imageModel ?? DEFAULT_IMAGE_MODEL;
            const normalized = coerceImageGenerationSettings(
                [imageModel],
                args.aspectRatio,
                args.resolution
            );
            const aspectRatio = normalized.aspectRatio as AspectRatio;
            const resolution = normalized.resolution as Resolution;
            const captionModel = args.captionModel ?? DEFAULT_CAPTION_MODEL;

            const origin = publicAppOriginForTemplates();
            let slideCount = 1;
            let refFiles: string[] = [];

            if (args.templateId?.trim()) {
                const template = getPostTemplateById(args.templateId.trim());
                if (!template) {
                    throw new Error("Template inválido");
                }
                refFiles = getPostTemplateReferenceFiles(template);
                slideCount = refFiles.length;
            }

            const imageUsage = estimateImageBatchUsage(
                Array.from({ length: slideCount }, () => imageModel)
            );
            const captionUsage = estimateCaptionUsage(captionModel);
            const reservationItems = [...imageUsage, ...captionUsage];
            const reservation = await reserveAiUsage(ctx, reservationItems);

            const styleReferenceUrls: string[] = [];
            if (args.projectContext?.contextImageUrls) {
                styleReferenceUrls.push(...args.projectContext.contextImageUrls);
            }

            let templateTitle: string | undefined;
            if (args.templateId?.trim()) {
                const t = getPostTemplateById(args.templateId.trim());
                templateTitle = t?.title;
            }

            let slidePrompts: string[] = [];
            try {
                slidePrompts = await splitPostBriefIntoSlidePrompts({
                    brief,
                    slideCount,
                    ...(templateTitle !== undefined ? { templateTitle } : {}),
                });
            } catch (e) {
                await refundAiUsage(ctx, reservation);
                throw e instanceof Error ? e : new Error(String(e));
            }

            const brandMd = args.projectContext?.brandContextMarkdown?.trim();
            const mediaItemIds: Id<"media_items">[] = [];
            const promptsForSuccessfulSlides: string[] = [];
            const failedImageLineItems: ReturnType<typeof estimateImageLineItem>[] = [];

            for (let i = 0; i < slideCount; i++) {
            const slidePrompt = slidePrompts[i] ?? brief;
            const augmentedMessage = brandMd
                ? `${brandMd}\n\n## Pedido de imagem (slide ${i + 1}/${slideCount})\n${slidePrompt}`
                : slidePrompt;

            const layoutReferenceUrls =
                refFiles.length > 0
                    ? [getTemplateReferencePublicUrl(origin, refFiles[i]!)]
                    : [];

            let layoutVisionPrompt: string | undefined;
            if (args.templateId?.trim()) {
                const template = getPostTemplateById(args.templateId.trim());
                if (template) {
                    layoutVisionPrompt =
                        refFiles.length > 1
                            ? buildCarouselSlideVisionPrompt(i, slideCount)
                            : template.visionPrompt;
                }
            }

            const out = await persistSingleGeneratedImage({
                ctx,
                userId: user._id,
                ...(args.projectId && { projectId: args.projectId }),
                message: augmentedMessage,
                userPrompt: slidePrompt,
                model: imageModel,
                aspectRatio,
                resolution,
                layoutReferenceUrls,
                productReferenceUrls: [],
                styleReferenceUrls,
                ...(layoutVisionPrompt && { layoutVisionPrompt }),
                ...(args.stylePreset && { stylePreset: args.stylePreset }),
            });

            if (out.success) {
                mediaItemIds.push(out.mediaItemId);
                promptsForSuccessfulSlides.push(slidePrompt);
            } else {
                failedImageLineItems.push(estimateImageLineItem(imageModel));
            }
        }

            if (failedImageLineItems.length > 0) {
                await refundAiUsage(ctx, failedImageLineItems);
            }

            if (mediaItemIds.length === 0) {
                await refundAiUsage(ctx, captionUsage);
                throw new Error("Não foi possível gerar nenhuma imagem. Tente outro modelo ou ajuste o brief.");
            }

            const referenceText = buildReferenceTextFromSlides(
                promptsForSuccessfulSlides,
                imageModel
            );

            try {
                const FALLBACK_CAPTION_MODEL = "google/gemini-2.5-flash";
                const modelChain = captionModel === FALLBACK_CAPTION_MODEL
                    ? [captionModel]
                    : [captionModel, FALLBACK_CAPTION_MODEL];
                let lastCaptionError: unknown = null;

                for (let index = 0; index < modelChain.length; index++) {
                    const modelToTry = modelChain[index]!;
                    try {
                        const cap = await generateCaption({
                            conversationHistory: [],
                            userMessage: brief,
                            referenceText,
                            model: modelToTry,
                            ...(args.projectContext && { projectContext: args.projectContext }),
                        });

                        const creditsUsed = round2(
                            sumUsageLineItemCredits(reservationItems) -
                                sumUsageLineItemCredits(failedImageLineItems)
                        );

                        if (index > 0) {
                            console.warn("[composePostFromBrief] caption fallback succeeded", {
                                requestedModel: captionModel,
                                usedModel: modelToTry,
                            });
                        }

                        return {
                            mediaItemIds,
                            caption: cap.caption,
                            explanation: cap.explanation,
                            creditsUsed,
                            captionFallbackUsed: index > 0,
                            captionModelRequested: captionModel,
                            captionModelUsed: modelToTry,
                        };
                    } catch (captionAttemptError) {
                        lastCaptionError = captionAttemptError;
                        console.warn("[composePostFromBrief] caption model failed", {
                            model: modelToTry,
                            attempt: index + 1,
                            totalAttempts: modelChain.length,
                            error: captionAttemptError,
                        });
                    }
                }

                throw lastCaptionError instanceof Error
                    ? lastCaptionError
                    : new Error(String(lastCaptionError ?? "Caption generation failed"));
            } catch (captionError) {
                // Caption step failed, but images are already generated and persisted.
                // Don't throw — surface a partial result so the post can still be saved
                // with an empty caption that the user can fill in manually.
                const captionMessage =
                    captionError instanceof Error ? captionError.message : String(captionError);
                console.error("[composePostFromBrief] caption failed, returning partial result", {
                    captionModel,
                    briefSample: brief.slice(0, 160),
                    mediaItemCount: mediaItemIds.length,
                    error: captionError,
                });
                await refundAiUsage(ctx, captionUsage);
                const creditsUsedPartial = round2(
                    sumUsageLineItemCredits(reservationItems) -
                        sumUsageLineItemCredits(failedImageLineItems) -
                        sumUsageLineItemCredits(captionUsage)
                );
                return {
                    mediaItemIds,
                    caption: "",
                    explanation: "",
                    creditsUsed: creditsUsedPartial,
                    captionFailed: true,
                    captionError: captionMessage,
                    captionFallbackUsed: captionModel !== "google/gemini-2.5-flash",
                    captionModelRequested: captionModel,
                    captionModelUsed: "google/gemini-2.5-flash",
                };
            }
        } catch (error) {
            console.error("[composePostFromBrief] failed", {
                templateId: args.templateId,
                imageModel: args.imageModel,
                captionModel: args.captionModel,
                projectId: args.projectId,
                hasProjectContext: !!args.projectContext,
                briefLength: args.brief?.length ?? 0,
                error,
            });
            throw error;
        }
    },
});

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
