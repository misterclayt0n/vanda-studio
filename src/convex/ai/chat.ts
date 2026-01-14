"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id, Doc } from "../_generated/dataModel";
import { generateCaption, generateImage, type ChatMessage } from "./agents/index";
import { MODELS } from "./llm/index";

// ============================================================================
// Types
// ============================================================================

const attachmentsValidator = v.optional(
    v.object({
        imageUrls: v.optional(v.array(v.string())),
        imageStorageIds: v.optional(v.array(v.id("_storage"))),
        instagramPostUrl: v.optional(v.string()),
        instagramPostCaption: v.optional(v.string()),
        referenceText: v.optional(v.string()),
    })
);

type Attachments = {
    imageUrls?: string[];
    imageStorageIds?: Id<"_storage">[];
    instagramPostUrl?: string;
    instagramPostCaption?: string;
    referenceText?: string;
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert database messages to ChatMessage format for the LLM
 */
function dbMessagesToChat(messages: Doc<"chat_messages">[]): ChatMessage[] {
    return messages.map((msg) => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
    }));
}

/**
 * Collect all reference image URLs from attachments
 */
async function collectReferenceImageUrls(
    ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } },
    attachments?: Attachments
): Promise<string[]> {
    const urls: string[] = [];

    // External URLs
    if (attachments?.imageUrls) {
        urls.push(...attachments.imageUrls);
    }

    // Storage IDs -> URLs
    if (attachments?.imageStorageIds) {
        for (const storageId of attachments.imageStorageIds) {
            const url = await ctx.storage.getUrl(storageId);
            if (url) {
                urls.push(url);
            }
        }
    }

    return urls;
}

/**
 * Build reference text from attachments
 */
function buildReferenceText(attachments?: Attachments): string | undefined {
    let referenceText: string | undefined;

    if (attachments?.referenceText) {
        referenceText = attachments.referenceText;
    }

    if (attachments?.instagramPostCaption) {
        referenceText = referenceText
            ? `${referenceText}\n\nPost do Instagram:\n"${attachments.instagramPostCaption}"`
            : `Post do Instagram:\n"${attachments.instagramPostCaption}"`;
    }

    return referenceText;
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Start a new post generation conversation
 * Creates the post and generates initial caption + image
 */
export const generate = action({
    args: {
        projectId: v.id("projects"),
        message: v.string(),
        attachments: attachmentsValidator,
    },
    handler: async (ctx, args): Promise<{
        success: boolean;
        generatedPostId: Id<"generated_posts">;
        caption: string;
        imageUrl: string | null;
    }> => {
        // 1. Auth check
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Voce precisa estar autenticado");
        }

        // 2. Verify project access
        const project = await ctx.runQuery(api.projects.get, {
            projectId: args.projectId,
        });
        if (!project) {
            throw new Error("Projeto nao encontrado");
        }

        // 3. Check quota (2 credits: caption + image)
        await ctx.runMutation(api.billing.usage.ensureSubscription, {});
        const quota = await ctx.runQuery(api.billing.usage.checkQuota, {});
        if (!quota || quota.remaining < 2) {
            throw new Error(
                `Creditos insuficientes. Necessario: 2. Disponivel: ${quota?.remaining ?? 0}`
            );
        }

        // 4. Create the generated_post record
        const generatedPostId = await ctx.runMutation(api.generatedPosts.create, {
            projectId: args.projectId,
            caption: "", // Will be updated after generation
            status: "in_progress",
        });

        // 5. Save user message
        await ctx.runMutation(internal.chatMessages.saveMessage, {
            generatedPostId,
            role: "user",
            content: args.message,
            action: "initial",
            ...(args.attachments && { attachments: args.attachments }),
        });

        // 6. Build reference text from attachments
        const referenceText = buildReferenceText(args.attachments);

        // 7. Generate caption
        const captionResult = await generateCaption({
            conversationHistory: [],
            userMessage: args.message,
            ...(referenceText && { referenceText }),
        });

        // 8. Collect reference images
        const referenceImageUrls = await collectReferenceImageUrls(ctx, args.attachments);

        // 9. Generate image
        let imageStorageId: Id<"_storage"> | undefined;
        let imagePrompt: string | undefined;

        try {
            const imageResult = await generateImage({
                caption: captionResult.caption,
                instructions: args.message,
                ...(referenceImageUrls.length > 0 && { referenceImageUrls }),
            });

            imagePrompt = imageResult.prompt;
            const binaryData = Uint8Array.from(atob(imageResult.imageBase64), (c) =>
                c.charCodeAt(0)
            );
            const blob = new Blob([binaryData], { type: imageResult.mimeType });
            imageStorageId = await ctx.storage.store(blob);
        } catch (err) {
            console.error("Image generation failed:", err);
            // Continue without image
        }

        // 10. Update generated_post with results
        await ctx.runMutation(api.generatedPosts.updateFromChat, {
            id: generatedPostId,
            caption: captionResult.caption,
            ...(imageStorageId && { imageStorageId }),
            ...(imagePrompt && { imagePrompt }),
            model: MODELS.GPT_4_1,
            ...(imageStorageId && { imageModel: MODELS.GEMINI_3_PRO_IMAGE }),
            status: "generated",
        });

        // 11. Save assistant message with snapshot
        const assistantContent = imageStorageId
            ? `${captionResult.explanation}\n\nGerei a legenda e a imagem com sucesso!`
            : `${captionResult.explanation}\n\n(A imagem nao pode ser gerada, mas a legenda esta pronta)`;

        await ctx.runMutation(internal.chatMessages.saveMessage, {
            generatedPostId,
            role: "assistant",
            content: assistantContent,
            snapshot: {
                caption: captionResult.caption,
                ...(imageStorageId && { imageStorageId }),
                ...(imagePrompt && { imagePrompt }),
            },
            model: MODELS.GPT_4_1,
            ...(imageStorageId && { imageModel: MODELS.GEMINI_3_PRO_IMAGE }),
            creditsUsed: imageStorageId ? 2 : 1,
        });

        // 12. Consume credits
        await ctx.runMutation(api.billing.usage.consumePrompt, {
            count: imageStorageId ? 2 : 1,
        });

        // 13. Get image URL for response
        let imageUrl: string | null = null;
        if (imageStorageId) {
            imageUrl = await ctx.storage.getUrl(imageStorageId);
        }

        return {
            success: true,
            generatedPostId,
            caption: captionResult.caption,
            imageUrl,
        };
    },
});

/**
 * Regenerate caption only
 */
export const regenerateCaption = action({
    args: {
        generatedPostId: v.id("generated_posts"),
        message: v.string(),
        attachments: attachmentsValidator,
    },
    handler: async (ctx, args) => {
        // 1. Auth check
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Voce precisa estar autenticado");
        }

        // 2. Get the post
        const post = await ctx.runQuery(api.generatedPosts.get, {
            id: args.generatedPostId,
        });
        if (!post) {
            throw new Error("Post nao encontrado");
        }

        // 3. Check quota (1 credit for caption only)
        const quota = await ctx.runQuery(api.billing.usage.checkQuota, {});
        if (!quota || quota.remaining < 1) {
            throw new Error(
                `Creditos insuficientes. Necessario: 1. Disponivel: ${quota?.remaining ?? 0}`
            );
        }

        // 4. Load conversation history
        const messages = await ctx.runQuery(api.chatMessages.getMessages, {
            generatedPostId: args.generatedPostId,
        });

        // 5. Save user message
        await ctx.runMutation(internal.chatMessages.saveMessage, {
            generatedPostId: args.generatedPostId,
            role: "user",
            content: args.message,
            action: "regenerate_caption",
            ...(args.attachments && { attachments: args.attachments }),
        });

        // 6. Build reference text
        const referenceText = buildReferenceText(args.attachments);

        // 7. Generate new caption with full context
        const captionResult = await generateCaption({
            conversationHistory: dbMessagesToChat(messages),
            currentCaption: post.caption,
            userMessage: args.message,
            ...(referenceText && { referenceText }),
        });

        // 8. Update post
        await ctx.runMutation(api.generatedPosts.updateFromChat, {
            id: args.generatedPostId,
            caption: captionResult.caption,
            model: MODELS.GPT_4_1,
            status: "regenerated",
        });

        // 9. Save assistant message with snapshot (keeping same image)
        await ctx.runMutation(internal.chatMessages.saveMessage, {
            generatedPostId: args.generatedPostId,
            role: "assistant",
            content: captionResult.explanation,
            snapshot: {
                caption: captionResult.caption,
                ...(post.imageStorageId && { imageStorageId: post.imageStorageId }),
                ...(post.imagePrompt && { imagePrompt: post.imagePrompt }),
            },
            model: MODELS.GPT_4_1,
            creditsUsed: 1,
        });

        // 10. Consume credit
        await ctx.runMutation(api.billing.usage.consumePrompt, { count: 1 });

        return {
            success: true,
            caption: captionResult.caption,
        };
    },
});

/**
 * Regenerate image only
 */
export const regenerateImage = action({
    args: {
        generatedPostId: v.id("generated_posts"),
        message: v.string(),
        attachments: attachmentsValidator,
    },
    handler: async (ctx, args) => {
        // 1. Auth check
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Voce precisa estar autenticado");
        }

        // 2. Get the post
        const post = await ctx.runQuery(api.generatedPosts.get, {
            id: args.generatedPostId,
        });
        if (!post) {
            throw new Error("Post nao encontrado");
        }

        // 3. Check quota (1 credit for image only)
        const quota = await ctx.runQuery(api.billing.usage.checkQuota, {});
        if (!quota || quota.remaining < 1) {
            throw new Error(
                `Creditos insuficientes. Necessario: 1. Disponivel: ${quota?.remaining ?? 0}`
            );
        }

        // 4. Save user message
        await ctx.runMutation(internal.chatMessages.saveMessage, {
            generatedPostId: args.generatedPostId,
            role: "user",
            content: args.message,
            action: "regenerate_image",
            ...(args.attachments && { attachments: args.attachments }),
        });

        // 5. Collect reference images
        const referenceImageUrls = await collectReferenceImageUrls(ctx, args.attachments);

        // 6. Generate new image
        let imageStorageId: Id<"_storage">;
        let imagePrompt: string;

        const imageResult = await generateImage({
            caption: post.caption,
            instructions: args.message,
            ...(referenceImageUrls.length > 0 && { referenceImageUrls }),
        });

        imagePrompt = imageResult.prompt;
        const binaryData = Uint8Array.from(atob(imageResult.imageBase64), (c) =>
            c.charCodeAt(0)
        );
        const blob = new Blob([binaryData], { type: imageResult.mimeType });
        imageStorageId = await ctx.storage.store(blob);

        // 7. Update post
        await ctx.runMutation(api.generatedPosts.updateFromChat, {
            id: args.generatedPostId,
            imageStorageId,
            imagePrompt,
            imageModel: MODELS.GEMINI_3_PRO_IMAGE,
            status: "regenerated",
        });

        // 8. Save assistant message with snapshot
        await ctx.runMutation(internal.chatMessages.saveMessage, {
            generatedPostId: args.generatedPostId,
            role: "assistant",
            content: "Regenerei a imagem com as novas instrucoes!",
            snapshot: {
                caption: post.caption,
                imageStorageId,
                imagePrompt,
            },
            imageModel: MODELS.GEMINI_3_PRO_IMAGE,
            creditsUsed: 1,
        });

        // 9. Consume credit
        await ctx.runMutation(api.billing.usage.consumePrompt, { count: 1 });

        // 10. Get image URL
        const imageUrl = await ctx.storage.getUrl(imageStorageId);

        return {
            success: true,
            imageUrl,
        };
    },
});
