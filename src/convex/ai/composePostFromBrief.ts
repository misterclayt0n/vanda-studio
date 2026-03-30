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
    }> => {
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
            const cap = await generateCaption({
                conversationHistory: [],
                userMessage: brief,
                referenceText,
                model: captionModel,
                ...(args.projectContext && { projectContext: args.projectContext }),
            });

            const creditsUsed = round2(
                sumUsageLineItemCredits(reservationItems) -
                    sumUsageLineItemCredits(failedImageLineItems)
            );

            return {
                mediaItemIds,
                caption: cap.caption,
                explanation: cap.explanation,
                creditsUsed,
            };
        } catch (e) {
            await refundAiUsage(ctx, captionUsage);
            throw e instanceof Error ? e : new Error(String(e));
        }
    },
});

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
