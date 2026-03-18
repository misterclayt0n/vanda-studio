"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id, Doc } from "../_generated/dataModel";
import { generateImage } from "./agents/index";
import { reserveImageUsage, refundImageUsage } from "../billing/autumnUsage";
import { createThumbnailBlob } from "../mediaProcessing";
import { coerceImageGenerationSettings } from "../../lib/studio/imageGenerationCapabilities";
import {
    type AspectRatio,
    type Resolution,
    calculateDimensions,
} from "./llm/index";

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

function dedupeUrls(urls: string[]): string[] {
    return [...new Set(urls)];
}

async function scheduleTurnGeneration(
    ctx: any,
    args: {
        conversationId: Id<"image_edit_conversations">;
        turnId: Id<"image_edit_turns">;
        userId: Id<"users">;
        selectedModelCount: number;
    }
) {
    const reservedCount = await reserveImageUsage(ctx, args.selectedModelCount);

    try {
        await ctx.scheduler.runAfter(0, internal.ai.imageEdit.processTurn, {
            conversationId: args.conversationId,
            turnId: args.turnId,
            userId: args.userId,
            reservedCount,
        });
    } catch (err) {
        await refundImageUsage(ctx, reservedCount);
        await ctx.runMutation(internal.imageEditTurns.markError, {
            id: args.turnId,
        });
        throw err;
    }
}

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
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Você precisa estar autenticado");
        }

        const user = await ctx.runQuery(api.users.current, {});
        if (!user) {
            throw new Error("Usuário não encontrado");
        }

        const result = await ctx.runMutation(api.imageEditConversations.startWithTurn, {
            sourceImageId: args.sourceImageId,
            userMessage: args.userMessage,
            selectedModels: args.selectedModels,
            ...(args.manualReferenceIds && { manualReferenceIds: args.manualReferenceIds }),
        });

        await scheduleTurnGeneration(ctx, {
            conversationId: result.conversationId,
            turnId: result.turnId,
            userId: user._id,
            selectedModelCount: args.selectedModels.length,
        });

        return {
            success: true,
            conversationId: result.conversationId,
        };
    },
});

export const sendEdit = action({
    args: {
        conversationId: v.id("image_edit_conversations"),
        userMessage: v.string(),
        selectedModels: v.array(v.string()),
        selectedOutputIds: v.optional(v.array(v.id("image_edit_outputs"))),
        aspectRatio: v.string(),
        resolution: v.string(),
        manualReferenceIds: v.optional(v.array(v.id("_storage"))),
    },
    handler: async (ctx, args): Promise<{
        success: boolean;
        turnId: Id<"image_edit_turns">;
    }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Você precisa estar autenticado");
        }

        const user = await ctx.runQuery(api.users.current, {});
        if (!user) {
            throw new Error("Usuário não encontrado");
        }

        const conversation = await ctx.runQuery(api.imageEditConversations.get, {
            id: args.conversationId,
        });
        if (!conversation) {
            throw new Error("Conversa não encontrada");
        }

        const turnCount = await ctx.runQuery(api.imageEditTurns.countByConversation, {
            conversationId: args.conversationId,
        });
        const normalizedSettings = coerceImageGenerationSettings(
            args.selectedModels,
            args.aspectRatio,
            args.resolution
        );

        const turnId = await ctx.runMutation(internal.imageEditTurns.create, {
            conversationId: args.conversationId,
            turnIndex: turnCount,
            userMessage: args.userMessage,
            selectedModels: args.selectedModels,
            ...(args.selectedOutputIds?.length
                ? { selectedOutputIds: args.selectedOutputIds }
                : {}),
            ...(args.manualReferenceIds && { manualReferenceIds: args.manualReferenceIds }),
            aspectRatio: normalizedSettings.aspectRatio,
            resolution: normalizedSettings.resolution,
        });

        await scheduleTurnGeneration(ctx, {
            conversationId: args.conversationId,
            turnId,
            userId: user._id,
            selectedModelCount: args.selectedModels.length,
        });

        return {
            success: true,
            turnId,
        };
    },
});

export const generateForTurn = action({
    args: {
        conversationId: v.id("image_edit_conversations"),
        turnId: v.id("image_edit_turns"),
    },
    handler: async (ctx, args): Promise<{ success: boolean }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Você precisa estar autenticado");
        }

        const user = await ctx.runQuery(api.users.current, {});
        if (!user) {
            throw new Error("Usuário não encontrado");
        }

        const turn = await ctx.runQuery(api.imageEditTurns.get, {
            id: args.turnId,
        });
        if (!turn) {
            throw new Error("Turno não encontrado");
        }

        await scheduleTurnGeneration(ctx, {
            conversationId: args.conversationId,
            turnId: args.turnId,
            userId: user._id,
            selectedModelCount: turn.selectedModels.length,
        });

        return { success: true };
    },
});

async function collectReferenceUrls(
    ctx: any,
    args: {
        conversation: any;
        turn: any;
    }
): Promise<string[]> {
    const referenceUrls: string[] = [];

    if (args.turn.selectedOutputIds?.length) {
        const selectedOutputs = await ctx.runQuery(internal.imageEditOutputs.listByIdsInternal, {
            ids: args.turn.selectedOutputIds,
        });
        for (const output of selectedOutputs) {
            if (output.url) {
                referenceUrls.push(output.url);
            }
        }
    } else if (args.turn.turnIndex === 0) {
        if (args.conversation.sourceImageUrl) {
            referenceUrls.push(args.conversation.sourceImageUrl);
        }
    } else {
        const previousTurn = await ctx.runQuery(internal.imageEditTurns.getByIndexInternal, {
            conversationId: args.conversation._id,
            turnIndex: args.turn.turnIndex - 1,
        });
        if (previousTurn?.outputs?.length) {
            for (const output of previousTurn.outputs) {
                if (output.url) {
                    referenceUrls.push(output.url);
                }
            }
        } else if (args.conversation.sourceImageUrl) {
            referenceUrls.push(args.conversation.sourceImageUrl);
        }
    }

    if (args.turn.manualReferenceIds?.length) {
        const manualUrls = await storageIdsToUrls(ctx, args.turn.manualReferenceIds);
        referenceUrls.push(...manualUrls);
    }

    return dedupeUrls(referenceUrls);
}

export const processTurn = internalAction({
    args: {
        conversationId: v.id("image_edit_conversations"),
        turnId: v.id("image_edit_turns"),
        userId: v.id("users"),
        reservedCount: v.number(),
    },
    handler: async (ctx, args): Promise<void> => {
        const conversation = await ctx.runQuery(internal.imageEditConversations.getInternal, {
            id: args.conversationId,
        });
        if (!conversation) {
            await refundImageUsage(ctx, args.reservedCount);
            return;
        }

        const turn = await ctx.runQuery(internal.imageEditTurns.getInternal, {
            id: args.turnId,
        });
        if (!turn) {
            await refundImageUsage(ctx, args.reservedCount);
            return;
        }

        const originalPost = conversation.originalPost as Doc<"generated_posts"> | null;
        const sourceMedia = conversation.sourceMedia as Doc<"media_items"> | null;
        const projectId = originalPost?.projectId ?? sourceMedia?.projectId;

        try {
            const referenceUrls = await collectReferenceUrls(ctx, {
                conversation,
                turn,
            });

            const aspectRatio = (turn.aspectRatio ?? conversation.aspectRatio) as AspectRatio;
            const resolution = (turn.resolution ?? conversation.resolution) as Resolution;
            const dimensions = calculateDimensions(aspectRatio, resolution);

            const results = await Promise.all(
                turn.selectedModels.map(async (model: string) => {
                    const startedAt = Date.now();
                    try {
                        const result = await generateImage({
                            caption: "",
                            instructions: turn.userMessage,
                            model,
                            aspectRatio,
                            resolution,
                            ...(referenceUrls.length > 0
                                ? { referenceImageUrls: referenceUrls }
                                : {}),
                        });

                        const binaryData = Uint8Array.from(atob(result.imageBase64), (char) =>
                            char.charCodeAt(0)
                        );
                        const blob = new Blob([binaryData], { type: result.mimeType });
                        const thumbnailBlob = await createThumbnailBlob(blob);
                        const storageId = await ctx.storage.store(blob);
                        const thumbnailStorageId = thumbnailBlob
                            ? await ctx.storage.store(thumbnailBlob)
                            : undefined;

                        await ctx.runMutation(internal.imageEditOutputs.create, {
                            turnId: args.turnId,
                            conversationId: args.conversationId,
                            storageId,
                            ...(thumbnailStorageId && { thumbnailStorageId }),
                            mimeType: result.mimeType,
                            model,
                            prompt: result.prompt,
                            userPrompt: turn.userMessage,
                            generationDurationMs: Date.now() - startedAt,
                            width: result.dimensions?.width ?? dimensions.width,
                            height: result.dimensions?.height ?? dimensions.height,
                            aspectRatio,
                            resolution,
                            userId: args.userId,
                            ...(projectId && { projectId }),
                        });

                        await ctx.runMutation(internal.imageEditTurns.removeFromPending, {
                            id: args.turnId,
                            model,
                        });

                        return true;
                    } catch (err) {
                        console.error(`[IMAGE_EDIT] Generation failed for ${model}:`, err);
                        await ctx.runMutation(internal.imageEditTurns.removeFromPending, {
                            id: args.turnId,
                            model,
                        });
                        return false;
                    }
                })
            );

            const failedCount = results.filter((success) => !success).length;
            if (failedCount > 0) {
                await refundImageUsage(ctx, failedCount);
            }

            if (failedCount === turn.selectedModels.length) {
                await ctx.runMutation(internal.imageEditTurns.markError, {
                    id: args.turnId,
                });
            }
        } catch (err) {
            console.error(`[IMAGE_EDIT] Async turn ${args.turnId} failed:`, err);
            await refundImageUsage(ctx, args.reservedCount);
            await ctx.runMutation(internal.imageEditTurns.markError, {
                id: args.turnId,
            });
            return;
        }
    },
});
