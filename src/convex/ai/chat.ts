"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id, Doc } from "../_generated/dataModel";
import { generateCaption, generateImage, type ChatMessage, type ProjectContext } from "./agents/index";
import {
    MODELS,
    IMAGE_MODELS,
    DEFAULT_IMAGE_MODEL,
    type AspectRatio,
    type Resolution,
    calculateDimensions,
} from "./llm/index";

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
 * Collect all reference image URLs from attachments and brand context
 */
async function collectReferenceImageUrls(
    ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } },
    attachments?: Attachments,
    contextImageUrls?: string[]
): Promise<string[]> {
    const urls: string[] = [];

    // External URLs from attachments
    if (attachments?.imageUrls) {
        urls.push(...attachments.imageUrls);
    }

    // Storage IDs from attachments -> URLs
    if (attachments?.imageStorageIds) {
        for (const storageId of attachments.imageStorageIds) {
            const url = await ctx.storage.getUrl(storageId);
            if (url) {
                urls.push(url);
            }
        }
    }

    // Brand context images from project settings
    if (contextImageUrls && contextImageUrls.length > 0) {
        urls.push(...contextImageUrls);
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
 * Generated image result type
 */
type GeneratedImageResult = {
    storageId: Id<"_storage">;
    model: string;
    url: string | null;
    prompt: string;
    width: number;
    height: number;
};

/**
 * Start a new post generation conversation
 * Creates the post and generates initial caption + images (one per model)
 * Uses progressive updates - caption and images update DB as they complete,
 * allowing frontend to show results progressively via subscriptions.
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
        projectId: v.optional(v.id("projects")), // Optional - can be null for standalone
        message: v.string(),
        attachments: attachmentsValidator,
        captionModel: v.optional(v.string()), // Model for caption generation
        imageModels: v.optional(v.array(v.string())), // Models to generate with
        aspectRatio: v.optional(v.string()), // "1:1", "16:9", etc.
        resolution: v.optional(v.string()), // "standard", "high", "ultra"
        projectContext: projectContextValidator, // Brand context for personalization
    },
    handler: async (ctx, args): Promise<{
        success: boolean;
        generatedPostId: Id<"generated_posts">;
    }> => {
        // 1. Auth check
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Voce precisa estar autenticado");
        }

        // 2. Verify project access (if projectId provided)
        if (args.projectId) {
            const project = await ctx.runQuery(api.projects.get, {
                projectId: args.projectId,
            });
            if (!project) {
                throw new Error("Projeto nao encontrado");
            }
        }

        // 3. Parse studio settings
        const imageModels = args.imageModels ?? [DEFAULT_IMAGE_MODEL];
        const aspectRatio = (args.aspectRatio ?? "1:1") as AspectRatio;
        const resolution = (args.resolution ?? "standard") as Resolution;
        const dimensions = calculateDimensions(aspectRatio, resolution);

        // 4. Create the generated_post record with progressive state
        const generatedPostId = await ctx.runMutation(api.generatedPosts.create, {
            ...(args.projectId && { projectId: args.projectId }),
            caption: "", // Will be updated after caption generation
            status: "generating_caption",
            pendingImageModels: imageModels,
            totalImageModels: imageModels.length,
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
        console.log(`[GENERATE] Generating caption with model: ${args.captionModel ?? MODELS.GPT_4_1}`);
        const captionResult = await generateCaption({
            conversationHistory: [],
            userMessage: args.message,
            ...(referenceText && { referenceText }),
            ...(args.captionModel && { model: args.captionModel }),
            ...(args.projectContext && { projectContext: args.projectContext }),
        });

        // 8. Update post with caption, change status to "generating_images"
        // This triggers subscription update so frontend shows caption immediately
        const captionModel = args.captionModel ?? MODELS.GPT_4_1;
        await ctx.runMutation(api.generatedPosts.updateFromChat, {
            id: generatedPostId,
            caption: captionResult.caption,
            model: captionModel,
            status: "generating_images",
        });
        console.log(`[GENERATE] Caption saved, starting image generation...`);

        // 9. Collect reference images (from attachments + brand context)
        const referenceImageUrls = await collectReferenceImageUrls(
            ctx,
            args.attachments,
            args.projectContext?.contextImageUrls
        );

        // 10. Generate images in parallel (one per model)
        // Each image saves to DB when done, removing from pendingImageModels
        console.log(`[GENERATE] Starting parallel image generation for ${imageModels.length} models`);

        await Promise.all(
            imageModels.map(async (model) => {
                try {
                    console.log(`[GENERATE] Generating image with model: ${model}`);

                    const imageResult = await generateImage({
                        caption: captionResult.caption,
                        instructions: args.message,
                        model,
                        aspectRatio,
                        resolution,
                        ...(referenceImageUrls.length > 0 && { referenceImageUrls }),
                    });

                    // Store the image
                    const binaryData = Uint8Array.from(atob(imageResult.imageBase64), (c) =>
                        c.charCodeAt(0)
                    );
                    const blob = new Blob([binaryData], { type: imageResult.mimeType });
                    const storageId = await ctx.storage.store(blob);

                    // Save to generated_images table (triggers subscription update)
                    await ctx.runMutation(api.generatedImages.create, {
                        generatedPostId,
                        storageId,
                        model,
                        aspectRatio,
                        resolution,
                        prompt: imageResult.prompt,
                        width: imageResult.dimensions?.width ?? dimensions.width,
                        height: imageResult.dimensions?.height ?? dimensions.height,
                    });

                    // Remove from pending models (triggers subscription update)
                    await ctx.runMutation(api.generatedPosts.removeFromPending, {
                        id: generatedPostId,
                        model,
                    });

                    console.log(`[GENERATE] Successfully generated image with ${model}`);
                } catch (err) {
                    console.error(`[GENERATE] Image generation failed for ${model}:`, err);
                    // Still remove from pending on failure so UI doesn't hang
                    await ctx.runMutation(api.generatedPosts.removeFromPending, {
                        id: generatedPostId,
                        model,
                    });
                }
            })
        );

        // 11. Get all successful images for final state
        const allImages = await ctx.runQuery(api.generatedImages.listByPost, {
            generatedPostId,
        });
        const primaryImage = allImages[0];
        const imageCount = allImages.length;

        // 12. Mark as completed with final state
        await ctx.runMutation(api.generatedPosts.updateFromChat, {
            id: generatedPostId,
            ...(primaryImage && { imageStorageId: primaryImage.storageId }),
            ...(primaryImage && { imagePrompt: primaryImage.prompt }),
            ...(primaryImage && { imageModel: primaryImage.model }),
            status: "generated",
            pendingImageModels: [], // Clear pending
        });

        // 13. Save assistant message with snapshot
        const assistantContent = imageCount > 0
            ? `${captionResult.explanation}\n\nGerei a legenda e ${imageCount} imagem(ns) com sucesso!`
            : `${captionResult.explanation}\n\n(As imagens nao puderam ser geradas, mas a legenda esta pronta)`;

        await ctx.runMutation(internal.chatMessages.saveMessage, {
            generatedPostId,
            role: "assistant",
            content: assistantContent,
            snapshot: {
                caption: captionResult.caption,
                ...(primaryImage && { imageStorageId: primaryImage.storageId }),
                ...(primaryImage && { imagePrompt: primaryImage.prompt }),
            },
            model: captionModel,
            ...(primaryImage && { imageModel: primaryImage.model }),
            creditsUsed: 1 + imageCount,
        });

        return {
            success: true,
            generatedPostId,
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
        captionModel: v.optional(v.string()), // Model for caption generation
        projectContext: projectContextValidator, // Brand context for personalization
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
        const captionModel = args.captionModel ?? MODELS.GPT_4_1;
        const captionResult = await generateCaption({
            conversationHistory: dbMessagesToChat(messages),
            currentCaption: post.caption,
            userMessage: args.message,
            ...(referenceText && { referenceText }),
            ...(args.captionModel && { model: args.captionModel }),
            ...(args.projectContext && { projectContext: args.projectContext }),
        });

        // 8. Update post
        await ctx.runMutation(api.generatedPosts.updateFromChat, {
            id: args.generatedPostId,
            caption: captionResult.caption,
            model: captionModel,
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
            model: captionModel,
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
        projectContext: projectContextValidator, // Brand context for personalization
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

        // 5. Collect reference images (from attachments + brand context)
        const referenceImageUrls = await collectReferenceImageUrls(
            ctx,
            args.attachments,
            args.projectContext?.contextImageUrls
        );

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
