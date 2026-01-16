"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { generateImage } from "./agents/index";
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
            throw new Error("Voce precisa estar autenticado");
        }

        // 2. Get current user
        const user = await ctx.runQuery(api.users.current, {});
        if (!user) {
            throw new Error("Usuario nao encontrado");
        }

        // 3. Get source image data
        const sourceImage = await ctx.runQuery(api.generatedImages.get, {
            id: args.sourceImageId,
        });
        if (!sourceImage) {
            throw new Error("Imagem de origem nao encontrada");
        }

        // 4. Get original post data (for caption inheritance)
        const originalPost = await ctx.runQuery(api.generatedPosts.get, {
            id: sourceImage.generatedPostId,
        });
        if (!originalPost) {
            throw new Error("Post original nao encontrado");
        }

        // 5. Create conversation
        const title = generateTitle(args.userMessage);
        const conversationId = await ctx.runMutation(api.imageEditConversations.create, {
            sourceImageId: args.sourceImageId,
            title,
            aspectRatio: sourceImage.aspectRatio,
            resolution: sourceImage.resolution,
        });

        console.log(`[IMAGE_EDIT] Created conversation ${conversationId} with title: "${title}"`);

        // 6. Create turn 0
        const turnId = await ctx.runMutation(internal.imageEditTurns.create, {
            conversationId,
            turnIndex: 0,
            userMessage: args.userMessage,
            selectedModels: args.selectedModels,
            ...(args.manualReferenceIds && { manualReferenceIds: args.manualReferenceIds }),
        });

        console.log(`[IMAGE_EDIT] Created turn 0: ${turnId}`);

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

        await Promise.all(
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
                        turnId,
                        conversationId,
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
                        id: turnId,
                        model,
                    });

                    console.log(`[IMAGE_EDIT] Successfully generated with ${model}`);
                } catch (err) {
                    console.error(`[IMAGE_EDIT] Generation failed for ${model}:`, err);
                    // Still remove from pending on failure
                    await ctx.runMutation(internal.imageEditTurns.removeFromPending, {
                        id: turnId,
                        model,
                    });
                }
            })
        );

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
            throw new Error("Voce precisa estar autenticado");
        }

        // 2. Get current user
        const user = await ctx.runQuery(api.users.current, {});
        if (!user) {
            throw new Error("Usuario nao encontrado");
        }

        // 3. Get conversation (now includes originalPost for caption)
        const conversation = await ctx.runQuery(api.imageEditConversations.get, {
            id: args.conversationId,
        });
        if (!conversation) {
            throw new Error("Conversa nao encontrada");
        }
        const originalPost = conversation.originalPost;
        if (!originalPost) {
            throw new Error("Post original nao encontrado");
        }

        // 5. Get previous turn's outputs (auto-references)
        const previousTurn = await ctx.runQuery(api.imageEditTurns.getLatest, {
            conversationId: args.conversationId,
        });

        // 6. Count existing turns to get next index
        const turnCount = await ctx.runQuery(api.imageEditTurns.countByConversation, {
            conversationId: args.conversationId,
        });

        // 7. Create new turn
        const turnId = await ctx.runMutation(internal.imageEditTurns.create, {
            conversationId: args.conversationId,
            turnIndex: turnCount,
            userMessage: args.userMessage,
            selectedModels: args.selectedModels,
            ...(args.manualReferenceIds && { manualReferenceIds: args.manualReferenceIds }),
        });

        console.log(`[IMAGE_EDIT] Created turn ${turnCount}: ${turnId}`);

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

        await Promise.all(
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
                        turnId,
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
                        id: turnId,
                        model,
                    });

                    console.log(`[IMAGE_EDIT] Successfully generated with ${model}`);
                } catch (err) {
                    console.error(`[IMAGE_EDIT] Generation failed for ${model}:`, err);
                    // Still remove from pending on failure
                    await ctx.runMutation(internal.imageEditTurns.removeFromPending, {
                        id: turnId,
                        model,
                    });
                }
            })
        );

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
            throw new Error("Voce precisa estar autenticado");
        }

        // 2. Get current user
        const user = await ctx.runQuery(api.users.current, {});
        if (!user) {
            throw new Error("Usuario nao encontrado");
        }

        // 3. Get conversation (includes originalPost for caption)
        const conversation = await ctx.runQuery(api.imageEditConversations.get, {
            id: args.conversationId,
        });
        if (!conversation) {
            throw new Error("Conversa nao encontrada");
        }
        const originalPost = conversation.originalPost;
        if (!originalPost) {
            throw new Error("Post original nao encontrado");
        }

        // 4. Get the turn
        const turn = await ctx.runQuery(api.imageEditTurns.get, {
            id: args.turnId,
        });
        if (!turn) {
            throw new Error("Turno nao encontrado");
        }

        // 5. Build reference URLs
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

        // 6. Parse dimensions
        const aspectRatio = conversation.aspectRatio as AspectRatio;
        const resolution = conversation.resolution as Resolution;
        const dimensions = calculateDimensions(aspectRatio, resolution);

        // 7. Generate images in parallel
        await Promise.all(
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
                } catch (err) {
                    console.error(`[IMAGE_EDIT] Generation failed for ${model}:`, err);
                    await ctx.runMutation(internal.imageEditTurns.removeFromPending, {
                        id: args.turnId,
                        model,
                    });
                }
            })
        );

        // 8. Update conversation timestamp
        await ctx.runMutation(api.imageEditConversations.touch, {
            id: args.conversationId,
        });

        return { success: true };
    },
});
