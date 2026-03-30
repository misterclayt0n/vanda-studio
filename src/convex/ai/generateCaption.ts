"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { generateCaption } from "./agents/index";
import { DEFAULT_CAPTION_MODEL } from "./llm/index";
import {
    estimateCaptionUsage,
    sumUsageLineItemCredits,
} from "../../lib/billing/aiCredits";
import { refundAiUsage, reserveAiUsage } from "../billing/autumnUsage";
import { projectContextValidator } from "./projectContextValidator";

/**
 * Standalone caption generation action.
 * Generates caption text WITHOUT creating any post or image records.
 */

export const generate = action({
    args: {
        message: v.string(),
        captionModel: v.optional(v.string()),
        projectContext: projectContextValidator,
        referenceText: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<{
        caption: string;
        explanation: string;
        creditsUsed: number;
    }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Você precisa estar autenticado");
        }

        const captionModel = args.captionModel ?? DEFAULT_CAPTION_MODEL;
        const usageItems = estimateCaptionUsage(captionModel);
        const reservation = await reserveAiUsage(ctx, usageItems);

        try {
            const result = await generateCaption({
                conversationHistory: [],
                userMessage: args.message,
                model: captionModel,
                ...(args.referenceText && { referenceText: args.referenceText }),
                ...(args.projectContext && { projectContext: args.projectContext }),
            });

            return {
                caption: result.caption,
                explanation: result.explanation,
                creditsUsed: sumUsageLineItemCredits(usageItems),
            };
        } catch (error) {
            await refundAiUsage(ctx, reservation);
            throw error;
        }
    },
});
