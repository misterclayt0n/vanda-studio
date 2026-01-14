import { Context, Effect, Layer } from "effect";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { z } from "zod";
import { MODELS, type ModelName } from "../models";
import { OpenRouterApiKey, SiteUrl } from "../config";
import {
    type AiError,
    MalformedResponseError,
    NetworkError,
    ProviderError,
    RateLimitError,
} from "../errors";

// ============================================================================
// Types
// ============================================================================

export interface CaptionResponse {
    caption: string;
    reasoning: string;
}

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface GenerateTextParams {
    messages: ChatMessage[];
    model?: ModelName;
    maxTokens?: number;
    temperature?: number;
}

export interface GenerateStructuredParams<T> {
    messages: ChatMessage[];
    schema: z.ZodSchema<T>;
    model?: ModelName;
    maxTokens?: number;
    temperature?: number;
}

// ============================================================================
// Service Definition
// ============================================================================

export class TextGeneration extends Context.Tag("TextGeneration")<
    TextGeneration,
    {
        /**
         * Generate a caption with reasoning (commonly used response format)
         */
        readonly generateCaption: (
            params: GenerateTextParams
        ) => Effect.Effect<CaptionResponse, AiError>;

        /**
         * Generate structured output with any Zod schema
         */
        readonly generateStructured: <T>(
            params: GenerateStructuredParams<T>
        ) => Effect.Effect<T, AiError>;

        /**
         * Generate raw text response
         */
        readonly generateText: (
            params: GenerateTextParams
        ) => Effect.Effect<string, AiError>;
    }
>() {}

// ============================================================================
// Error Mapping
// ============================================================================

function mapAiSdkError(error: unknown): AiError {
    // Handle fetch/network errors
    if (error instanceof TypeError && String(error).includes("fetch")) {
        return new NetworkError({ cause: error });
    }

    // Handle AI SDK specific errors
    if (error instanceof Error) {
        const message = error.message.toLowerCase();

        // Rate limit errors
        if (message.includes("rate limit") || message.includes("429")) {
            return new RateLimitError({});
        }

        // Parse/malformed response errors
        if (
            message.includes("parse") ||
            message.includes("json") ||
            message.includes("schema")
        ) {
            return new MalformedResponseError({
                rawResponse: error.message,
                parseError: error.message,
            });
        }

        // Provider/API errors (check for HTTP status codes in message)
        const statusMatch = error.message.match(/(\d{3})/);
        if (statusMatch && statusMatch[1]) {
            const status = parseInt(statusMatch[1], 10);
            if (status >= 400) {
                return new ProviderError({ status, message: error.message });
            }
        }

        // Generic provider error
        return new ProviderError({ status: 500, message: error.message });
    }

    // Fallback for unknown errors
    return new NetworkError({ cause: error });
}

// ============================================================================
// Implementation
// ============================================================================

const CaptionSchema = z.object({
    caption: z.string(),
    reasoning: z.string(),
});

export const TextGenerationLive = Layer.effect(
    TextGeneration,
    Effect.gen(function* () {
        const apiKey = yield* OpenRouterApiKey;
        const siteUrl = yield* SiteUrl;

        const openrouter = createOpenRouter({
            apiKey,
            headers: {
                "HTTP-Referer": siteUrl,
                "X-Title": "Vanda Studio",
            },
        });

        return {
            generateCaption: (params) =>
                Effect.tryPromise({
                    try: async () => {
                        const model = params.model ?? MODELS.GPT_4_1;

                        // Build messages for AI SDK
                        const systemMessage = params.messages.find(
                            (m) => m.role === "system"
                        );
                        const userMessages = params.messages.filter(
                            (m) => m.role !== "system"
                        );

                        const { experimental_output } = await generateText({
                            model: openrouter.chat(model),
                            ...(systemMessage?.content && { system: systemMessage.content }),
                            messages: userMessages.map((m) => ({
                                role: m.role as "user" | "assistant",
                                content: m.content,
                            })),
                            maxOutputTokens: params.maxTokens ?? 1024,
                            temperature: params.temperature ?? 0.7,
                            experimental_output: Output.object({
                                schema: CaptionSchema,
                            }),
                        });

                        return experimental_output as CaptionResponse;
                    },
                    catch: mapAiSdkError,
                }),

            generateStructured: <T>(params: GenerateStructuredParams<T>) =>
                Effect.tryPromise({
                    try: async () => {
                        const model = params.model ?? MODELS.GPT_4_1;

                        const systemMessage = params.messages.find(
                            (m) => m.role === "system"
                        );
                        const userMessages = params.messages.filter(
                            (m) => m.role !== "system"
                        );

                        const { experimental_output } = await generateText({
                            model: openrouter.chat(model),
                            ...(systemMessage?.content && { system: systemMessage.content }),
                            messages: userMessages.map((m) => ({
                                role: m.role as "user" | "assistant",
                                content: m.content,
                            })),
                            maxOutputTokens: params.maxTokens ?? 1024,
                            temperature: params.temperature ?? 0.7,
                            experimental_output: Output.object({
                                schema: params.schema,
                            }),
                        });

                        return experimental_output as T;
                    },
                    catch: mapAiSdkError,
                }),

            generateText: (params) =>
                Effect.tryPromise({
                    try: async () => {
                        const model = params.model ?? MODELS.GPT_4_1;

                        const systemMessage = params.messages.find(
                            (m) => m.role === "system"
                        );
                        const userMessages = params.messages.filter(
                            (m) => m.role !== "system"
                        );

                        const { text } = await generateText({
                            model: openrouter.chat(model),
                            ...(systemMessage?.content && { system: systemMessage.content }),
                            messages: userMessages.map((m) => ({
                                role: m.role as "user" | "assistant",
                                content: m.content,
                            })),
                            maxOutputTokens: params.maxTokens ?? 4096,
                            temperature: params.temperature ?? 0.7,
                        });

                        return text;
                    },
                    catch: mapAiSdkError,
                }),
        };
    })
);
