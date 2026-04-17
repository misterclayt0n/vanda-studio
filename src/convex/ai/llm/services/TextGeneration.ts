import { Context, Effect, Layer } from "effect";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
    generateText,
    NoObjectGeneratedError,
    NoOutputGeneratedError,
    NoOutputSpecifiedError,
    Output,
    type LanguageModel,
} from "ai";
import { z } from "zod";
import { MODELS, DEFAULT_CAPTION_MODEL, type ModelName } from "../models";
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

    if (NoObjectGeneratedError.isInstance(error)) {
        return new MalformedResponseError({
            rawResponse: error.text ?? error.message,
            parseError: error.message,
        });
    }

    if (NoOutputSpecifiedError.isInstance(error)) {
        return new MalformedResponseError({
            rawResponse: error.message,
            parseError: "no_output_specified",
        });
    }

    if (NoOutputGeneratedError.isInstance(error)) {
        return new MalformedResponseError({
            rawResponse: error.message,
            parseError: "no_output_generated",
        });
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

/**
 * Best-effort recovery when a model returns JSON wrapped in markdown fences or prose.
 * Extracts the first balanced `{...}` block and JSON-parses it.
 */
function tryExtractJsonObject(text: string): unknown | null {
    if (!text) return null;
    // Strip markdown fences
    const fenceStripped = text
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "");
    const start = fenceStripped.indexOf("{");
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < fenceStripped.length; i++) {
        const ch = fenceStripped[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (ch === "\\") {
            escape = true;
            continue;
        }
        if (ch === "\"") {
            inString = !inString;
            continue;
        }
        if (inString) continue;
        if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) {
                const candidate = fenceStripped.slice(start, i + 1);
                try {
                    return JSON.parse(candidate);
                } catch {
                    return null;
                }
            }
        }
    }
    return null;
}

/**
 * AI SDK 5 only fills `experimental_output` when the last step's `finishReason` is `"stop"`.
 * For `"length"`, `"content-filter"`, etc., `resolvedOutput` is never set and the getter throws
 * `NoOutputSpecifiedError` even though `text` contains a usable JSON blob. Parse manually in that case.
 */
async function parseStructuredFromGenerateTextResult<T>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GenerateTextResult is generic-heavy
    result: any,
    schema: z.ZodSchema<T>
): Promise<T> {
    try {
        return result.experimental_output as T;
    } catch (e) {
        if (!NoOutputSpecifiedError.isInstance(e)) {
            throw e;
        }
    }

    const spec = Output.object({ schema });
    return (await spec.parseOutput(
        { text: result.text },
        {
            response: result.response,
            usage: result.usage,
            finishReason: result.finishReason,
        }
    )) as T;
}

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
        const getModel = (model: ModelName): LanguageModel =>
            // Workaround for AI SDK/OpenRouter typing mismatch under exactOptionalPropertyTypes.
            openrouter.chat(model) as unknown as LanguageModel;

        return {
            generateCaption: (params) =>
                Effect.tryPromise({
                    try: async () => {
                        const model = params.model ?? DEFAULT_CAPTION_MODEL;

                        // Build messages for AI SDK
                        const systemMessage = params.messages.find(
                            (m) => m.role === "system"
                        );
                        const userMessages = params.messages.filter(
                            (m) => m.role !== "system"
                        );

                        const result = await generateText({
                            model: getModel(model),
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

                        try {
                            return await parseStructuredFromGenerateTextResult(result, CaptionSchema);
                        } catch (parseError) {
                            // Log raw response so we can debug non-conforming model output (Kimi sometimes
                            // wraps JSON in markdown fences, adds prose, truncates, etc.)
                            console.error("[TextGeneration.generateCaption] parse failed", {
                                model,
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                finishReason: (result as any)?.finishReason,
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                rawTextSample: String((result as any)?.text ?? "").slice(0, 2000),
                                parseError,
                            });

                            // Second attempt: try to recover by extracting the largest JSON object in `text`.
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const rawText = String((result as any)?.text ?? "");
                            const recovered = tryExtractJsonObject(rawText);
                            if (recovered) {
                                const parsed = CaptionSchema.safeParse(recovered);
                                if (parsed.success) {
                                    return parsed.data;
                                }
                            }
                            throw parseError;
                        }
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

                        const result = await generateText({
                            model: getModel(model),
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

                        return await parseStructuredFromGenerateTextResult(result, params.schema);
                    },
                    catch: (error: unknown) => {
                        console.error("[TextGeneration.generateStructured]", error);
                        return mapAiSdkError(error);
                    },
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
                            model: getModel(model),
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
