"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { generateImage } from "./agents/index";
import { reserveImageUsage, refundImageUsage } from "../billing/autumnUsage";
import {
    type AspectRatio,
    type Resolution,
    calculateDimensions,
} from "./llm/index";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a title from the first user message (truncated)
 */
function generateTitle(message: string, maxLength = 50): string {
    const cleaned = message.trim().replace(/\n/g, " ");
    if (cleaned.length <= maxLength) {
        return cleaned;
    }
    return cleaned.substring(0, maxLength - 3) + "...";
}

/**
 * Convert storage IDs to URLs
 */
async function storageIdsToUrls(
    ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } },
    storageIds: Id<"_storage">[]
): Promise<string[]> {
    const urls: string[] = [];
    for (const id of storageIds) {
        const url = await ctx.storage.getUrl(id);
        if (url) {
            urls.push(url);
        }
    }
    return urls;
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Start a new image editing conversation
 * Creates the conversation, first turn, and generates images
 */
export const startConversation = action({
    args: {
        sourceImageId: v.id("generated_images"),
        userMessage: v.string(),
        selectedModels: v.array(v.string()),
        manualReferenceIds: v.optional(v.array(v.id("_storage"))),
    },
    handler: async (ctx, args): Promise<{
        success: boolean;
        conversationId: Id<"image_edit_conversations">;
    }> => {
        // 1. Auth check
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Você precisa estar autenticado");
        }

        // 2. Get current user
        const user = await ctx.runQuery(api.users.current, {});
        if (!user) {
            throw new Error("Usuário não encontrado");
        }

        // 3. Get source image data
        const sourceImage = await ctx.runQuery(api.generatedImages.get, {
            id: args.sourceImageId,
        });
        if (!sourceImage) {
            throw new Error("Imagem de origem não encontrada");
        }

        // 4. Get original post data (for caption inheritance)
        const originalPost = await ctx.runQuery(api.generatedPosts.get, {
            id: sourceImage.generatedPostId,
        });
        if (!originalPost) {
            throw new Error("Post original não encontrado");
        }

        // 5. Reserve usage before starting generation
        const reservedCount = await reserveImageUsage(ctx, args.selectedModels.length);

        let conversationId: Id<"image_edit_conversations"> | null = null;
        let turnId: Id<"image_edit_turns"> | null = null;
        let results: boolean[] = [];

        try {
            // 6. Create conversation + initial turn
            const title = generateTitle(args.userMessage);
            conversationId = await ctx.runMutation(api.imageEditConversations.create, {
                sourceImageId: args.sourceImageId,
                title,
                aspectRatio: sourceImage.aspectRatio,
                resolution: sourceImage.resolution,
            });

            console.log(`[IMAGE_EDIT] Created conversation ${conversationId} with title: "${title}"`);

            turnId = await ctx.runMutation(internal.imageEditTurns.create, {
                conversationId,
                turnIndex: 0,
                userMessage: args.userMessage,
                selectedModels: args.selectedModels,
                ...(args.manualReferenceIds && { manualReferenceIds: args.manualReferenceIds }),
            });

            console.log(`[IMAGE_EDIT] Created turn 0: ${turnId}`);

            const conversationIdValue = conversationId;
            const turnIdValue = turnId;
            if (!conversationIdValue || !turnIdValue) {
                throw new Error("Falha ao iniciar a conversa de edição");
            }

            // 7. Build reference URLs
            // Source image is the primary reference
            const referenceUrls: string[] = [];
            if (sourceImage.url) {
                referenceUrls.push(sourceImage.url);
            }

            // Add manual references if any
            if (args.manualReferenceIds && args.manualReferenceIds.length > 0) {
                const manualUrls = await storageIdsToUrls(ctx, args.manualReferenceIds);
                referenceUrls.push(...manualUrls);
            }

            // 8. Parse dimensions
            const aspectRatio = sourceImage.aspectRatio as AspectRatio;
            const resolution = sourceImage.resolution as Resolution;
            const dimensions = calculateDimensions(aspectRatio, resolution);

            // 9. Generate images in parallel
            console.log(`[IMAGE_EDIT] Starting parallel generation for ${args.selectedModels.length} models`);

            results = await Promise.all(
                args.selectedModels.map(async (model) => {
                    try {
                        console.log(`[IMAGE_EDIT] Generating with model: ${model}`);

                        const result = await generateImage({
                            caption: "", // Not using caption for edits
                            instructions: args.userMessage,
                            model,
                            aspectRatio,
                            resolution,
                            referenceImageUrls: referenceUrls,
                        });

                        // Store the image
                        const binaryData = Uint8Array.from(atob(result.imageBase64), (c) =>
                            c.charCodeAt(0)
                        );
                        const blob = new Blob([binaryData], { type: result.mimeType });
                        const storageId = await ctx.storage.store(blob);

                        // Save output (also creates gallery post for composability)
                        await ctx.runMutation(internal.imageEditOutputs.create, {
                        turnId: turnIdValue,
                        conversationId: conversationIdValue,
                            storageId,
                            model,
                            prompt: result.prompt,
                            width: result.dimensions?.width ?? dimensions.width,
                            height: result.dimensions?.height ?? dimensions.height,
                            // Data for gallery post creation
                            aspectRatio: sourceImage.aspectRatio,
                            resolution: sourceImage.resolution,
                            originalPostId: originalPost._id,
                            originalCaption: originalPost.caption,
                            userId: user._id,
                        });

                        // Remove from pending
                        await ctx.runMutation(internal.imageEditTurns.removeFromPending, {
                            id: turnIdValue,
                            model,
                        });

                        console.log(`[IMAGE_EDIT] Successfully generated with ${model}`);
                        return true;
                    } catch (err) {
                        console.error(`[IMAGE_EDIT] Generation failed for ${model}:`, err);
                        // Still remove from pending on failure
                        await ctx.runMutation(internal.imageEditTurns.removeFromPending, {
                            id: turnIdValue,
                            model,
                        });
                        return false;
                    }
                })
            );
        } catch (err) {
            await refundImageUsage(ctx, reservedCount);
            throw err;
        }

        if (!conversationId || !turnId) {
            throw new Error("Falha ao iniciar a conversa de edição");
        }

        const failedCount = results.filter((success) => !success).length;
        if (failedCount > 0) {
            await refundImageUsage(ctx, failedCount);
        }

        // 10. Update conversation timestamp
        await ctx.runMutation(api.imageEditConversations.touch, {
            id: conversationId,
        });

        console.log(`[IMAGE_EDIT] Conversation ${conversationId} complete`);

        return {
            success: true,
            conversationId,
        };
    },
});

/**
 * Send a new edit in an existing conversation
 * Creates a new turn and generates images using previous outputs as references
 */
export const sendEdit = action({
    args: {
        conversationId: v.id("image_edit_conversations"),
        userMessage: v.string(),
        selectedModels: v.array(v.string()),
        manualReferenceIds: v.optional(v.array(v.id("_storage"))),
    },
    handler: async (ctx, args): Promise<{
        success: boolean;
        turnId: Id<"image_edit_turns">;
    }> => {
        // 1. Auth check
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Você precisa estar autenticado");
        }

        // 2. Get current user
        const user = await ctx.runQuery(api.users.current, {});
        if (!user) {
            throw new Error("Usuário não encontrado");
        }

        // 3. Get conversation (now includes originalPost for caption)
        const conversation = await ctx.runQuery(api.imageEditConversations.get, {
            id: args.conversationId,
        });
        if (!conversation) {
            throw new Error("Conversa não encontrada");
        }
        const originalPost = conversation.originalPost;
        if (!originalPost) {
            throw new Error("Post original não encontrado");
        }

        // 4. Get previous turn's outputs (auto-references)
        const previousTurn = await ctx.runQuery(api.imageEditTurns.getLatest, {
            conversationId: args.conversationId,
        });

        // 5. Count existing turns to get next index
        const turnCount = await ctx.runQuery(api.imageEditTurns.countByConversation, {
            conversationId: args.conversationId,
        });

        // 6. Reserve usage before starting generation
        const reservedCount = await reserveImageUsage(ctx, args.selectedModels.length);

        let turnId: Id<"image_edit_turns"> | null = null;
        let results: boolean[] = [];

        try {
            // 7. Create new turn
            turnId = await ctx.runMutation(internal.imageEditTurns.create, {
                conversationId: args.conversationId,
                turnIndex: turnCount,
                userMessage: args.userMessage,
                selectedModels: args.selectedModels,
                ...(args.manualReferenceIds && { manualReferenceIds: args.manualReferenceIds }),
            });

            console.log(`[IMAGE_EDIT] Created turn ${turnCount}: ${turnId}`);

            const turnIdValue = turnId;
            if (!turnIdValue) {
                throw new Error("Falha ao criar o turno de edição");
            }

            // 8. Build reference URLs from previous turn's outputs
            const referenceUrls: string[] = [];

            // Add previous turn's outputs as references (auto-reference)
            if (previousTurn && previousTurn.outputs) {
                for (const output of previousTurn.outputs) {
                    if (output.url) {
                        referenceUrls.push(output.url);
                    }
                }
            } else {
                // If no previous turn outputs, use source image
                if (conversation.sourceImageUrl) {
                    referenceUrls.push(conversation.sourceImageUrl);
                }
            }

            // Add manual references if any
            if (args.manualReferenceIds && args.manualReferenceIds.length > 0) {
                const manualUrls = await storageIdsToUrls(ctx, args.manualReferenceIds);
                referenceUrls.push(...manualUrls);
            }

            console.log(`[IMAGE_EDIT] Using ${referenceUrls.length} reference images`);

            // 9. Parse dimensions
            const aspectRatio = conversation.aspectRatio as AspectRatio;
            const resolution = conversation.resolution as Resolution;
            const dimensions = calculateDimensions(aspectRatio, resolution);

            // 10. Generate images in parallel
            console.log(`[IMAGE_EDIT] Starting parallel generation for ${args.selectedModels.length} models`);

            results = await Promise.all(
                args.selectedModels.map(async (model) => {
                    try {
                        console.log(`[IMAGE_EDIT] Generating with model: ${model}`);

                        const result = await generateImage({
                            caption: "", // Not using caption for edits
                            instructions: args.userMessage,
                            model,
                            aspectRatio,
                            resolution,
                            referenceImageUrls: referenceUrls,
                        });

                        // Store the image
                        const binaryData = Uint8Array.from(atob(result.imageBase64), (c) =>
                            c.charCodeAt(0)
                        );
                        const blob = new Blob([binaryData], { type: result.mimeType });
                        const storageId = await ctx.storage.store(blob);

                        // Save output (also creates gallery post for composability)
                        await ctx.runMutation(internal.imageEditOutputs.create, {
                        turnId: turnIdValue,
                        conversationId: args.conversationId,
                            storageId,
                            model,
                            prompt: result.prompt,
                            width: result.dimensions?.width ?? dimensions.width,
                            height: result.dimensions?.height ?? dimensions.height,
                            // Data for gallery post creation
                            aspectRatio: conversation.aspectRatio,
                            resolution: conversation.resolution,
                            originalPostId: originalPost._id,
                            originalCaption: originalPost.caption,
                            userId: user._id,
                        });

                        // Remove from pending
                        await ctx.runMutation(internal.imageEditTurns.removeFromPending, {
                            id: turnIdValue,
                            model,
                        });

                        console.log(`[IMAGE_EDIT] Successfully generated with ${model}`);
                        return true;
                    } catch (err) {
                        console.error(`[IMAGE_EDIT] Generation failed for ${model}:`, err);
                        // Still remove from pending on failure
                        await ctx.runMutation(internal.imageEditTurns.removeFromPending, {
                            id: turnIdValue,
                            model,
                        });
                        return false;
                    }
                })
            );
        } catch (err) {
            await refundImageUsage(ctx, reservedCount);
            throw err;
        }

        if (!turnId) {
            throw new Error("Falha ao criar o turno de edição");
        }

        const failedCount = results.filter((success) => !success).length;
        if (failedCount > 0) {
            await refundImageUsage(ctx, failedCount);
        }

        // 11. Update conversation timestamp
        await ctx.runMutation(api.imageEditConversations.touch, {
            id: args.conversationId,
        });

        console.log(`[IMAGE_EDIT] Turn ${turnCount} complete`);

        return {
            success: true,
            turnId,
        };
    },
});

/**
 * Generate images for an existing turn (called after navigating to conversation page)
 * This allows the modal to close immediately and generation happens on the conversation page
 */
export const generateForTurn = action({
    args: {
        conversationId: v.id("image_edit_conversations"),
        turnId: v.id("image_edit_turns"),
    },
    handler: async (ctx, args): Promise<{ success: boolean }> => {
        // 1. Auth check
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Você precisa estar autenticado");
        }

        // 2. Get current user
        const user = await ctx.runQuery(api.users.current, {});
        if (!user) {
            throw new Error("Usuário não encontrado");
        }

        // 3. Get conversation (includes originalPost for caption)
        const conversation = await ctx.runQuery(api.imageEditConversations.get, {
            id: args.conversationId,
        });
        if (!conversation) {
            throw new Error("Conversa não encontrada");
        }
        const originalPost = conversation.originalPost;
        if (!originalPost) {
            throw new Error("Post original não encontrado");
        }

        // 4. Get the turn
        const turn = await ctx.runQuery(api.imageEditTurns.get, {
            id: args.turnId,
        });
        if (!turn) {
            throw new Error("Turno não encontrado");
        }

        // 5. Reserve usage before starting generation
        const reservedCount = await reserveImageUsage(ctx, turn.selectedModels.length);

        let results: boolean[] = [];

        try {
            // 6. Build reference URLs
            const referenceUrls: string[] = [];

            // Source image is the primary reference for first turn
            if (turn.turnIndex === 0) {
                if (conversation.sourceImageUrl) {
                    referenceUrls.push(conversation.sourceImageUrl);
                }
            } else {
                // For subsequent turns, get previous turn's outputs
                const previousTurn = await ctx.runQuery(api.imageEditTurns.getByIndex, {
                    conversationId: args.conversationId,
                    turnIndex: turn.turnIndex - 1,
                });
                if (previousTurn?.outputs) {
                    for (const output of previousTurn.outputs) {
                        if (output.url) {
                            referenceUrls.push(output.url);
                        }
                    }
                } else if (conversation.sourceImageUrl) {
                    // Fallback to source image
                    referenceUrls.push(conversation.sourceImageUrl);
                }
            }

            // Add manual references if any
            if (turn.manualReferenceIds && turn.manualReferenceIds.length > 0) {
                const manualUrls = await storageIdsToUrls(ctx, turn.manualReferenceIds);
                referenceUrls.push(...manualUrls);
            }

            console.log(`[IMAGE_EDIT] Generating for turn ${turn.turnIndex} with ${referenceUrls.length} references`);

            // 7. Parse dimensions
            const aspectRatio = conversation.aspectRatio as AspectRatio;
            const resolution = conversation.resolution as Resolution;
            const dimensions = calculateDimensions(aspectRatio, resolution);

            // 8. Generate images in parallel
            results = await Promise.all(
                turn.selectedModels.map(async (model) => {
                    try {
                        console.log(`[IMAGE_EDIT] Generating with model: ${model}`);

                        const result = await generateImage({
                            caption: "",
                            instructions: turn.userMessage,
                            model,
                            aspectRatio,
                            resolution,
                            referenceImageUrls: referenceUrls,
                        });

                        // Store the image
                        const binaryData = Uint8Array.from(atob(result.imageBase64), (c) =>
                            c.charCodeAt(0)
                        );
                        const blob = new Blob([binaryData], { type: result.mimeType });
                        const storageId = await ctx.storage.store(blob);

                        // Save output (also creates gallery post)
                        await ctx.runMutation(internal.imageEditOutputs.create, {
                            turnId: args.turnId,
                            conversationId: args.conversationId,
                            storageId,
                            model,
                            prompt: result.prompt,
                            width: result.dimensions?.width ?? dimensions.width,
                            height: result.dimensions?.height ?? dimensions.height,
                            aspectRatio: conversation.aspectRatio,
                            resolution: conversation.resolution,
                            originalPostId: originalPost._id,
                            originalCaption: originalPost.caption,
                            userId: user._id,
                        });

                        // Remove from pending
                        await ctx.runMutation(internal.imageEditTurns.removeFromPending, {
                            id: args.turnId,
                            model,
                        });

                        console.log(`[IMAGE_EDIT] Successfully generated with ${model}`);
                        return true;
                    } catch (err) {
                        console.error(`[IMAGE_EDIT] Generation failed for ${model}:`, err);
                        // Note: NO credit consumed on failure
                        await ctx.runMutation(internal.imageEditTurns.removeFromPending, {
                            id: args.turnId,
                            model,
                        });
                        return false;
                    }
                })
            );
        } catch (err) {
            await refundImageUsage(ctx, reservedCount);
            throw err;
        }

        const failedCount = results.filter((success) => !success).length;
        if (failedCount > 0) {
            await refundImageUsage(ctx, failedCount);
        }

        // 8. Update conversation timestamp
        await ctx.runMutation(api.imageEditConversations.touch, {
            id: args.conversationId,
        });

        return { success: true };
    },
});
