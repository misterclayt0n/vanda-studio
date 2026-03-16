"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { generateCaption } from "./agents/index";
import { MODELS } from "./llm/index";

/**
 * Standalone caption generation action.
 * Generates caption text WITHOUT creating any post or image records.
 */

const projectContextValidator = v.optional(
    v.object({
        accountDescription: v.optional(v.string()),
        brandTraits: v.optional(v.array(v.string())),
        additionalContext: v.optional(v.string()),
        contextImageUrls: v.optional(v.array(v.string())),
    })
);

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
    }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Você precisa estar autenticado");
        }

        const captionModel = args.captionModel ?? MODELS.GPT_4_1;

        const result = await generateCaption({
            conversationHistory: [],
            userMessage: args.message,
            ...(args.referenceText && { referenceText: args.referenceText }),
            ...(args.captionModel && { model: args.captionModel }),
            ...(args.projectContext && { projectContext: args.projectContext }),
        });

        return {
            caption: result.caption,
            explanation: result.explanation,
        };
    },
});
