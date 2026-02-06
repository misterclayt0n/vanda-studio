import { Context, Effect, Layer } from "effect";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, type LanguageModel } from "ai";
import { DEFAULT_IMAGE_MODEL, IMAGE_MODEL_CAPABILITIES, type ImageModelName } from "../models";
import { OpenRouterApiKey, SiteUrl } from "../config";
import {
    type AiError,
    ImageGenerationError,
    MalformedResponseError,
    NetworkError,
    ProviderError,
    RateLimitError,
} from "../errors";
import {
    type AspectRatio,
    type Resolution,
    calculateDimensions,
} from "../types";

// ============================================================================
// Types
// ============================================================================

export interface ReferenceImage {
    url: string;
    description?: string;
}

export interface ImageGenerationParams {
    prompt: string;
    referenceImages?: ReferenceImage[];
    model?: string;
    aspectRatio?: AspectRatio;
    resolution?: Resolution;
}

export interface ImageGenerationResponse {
    imageBase64: string;
    mimeType: string;
    dimensions?: { width: number; height: number };
}

// ============================================================================
// Service Definition
// ============================================================================

export class ImageGeneration extends Context.Tag("ImageGeneration")<
    ImageGeneration,
    {
        /**
         * Generate an image using an image generation model via OpenRouter
         */
        readonly generateImage: (
            params: ImageGenerationParams
        ) => Effect.Effect<ImageGenerationResponse, AiError>;
    }
>() {}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Fetch an image from URL and convert to base64 data URL
 */
async function fetchImageAsBase64(url: string): Promise<string | null> {
    try {
        // Skip if already a data URL
        if (url.startsWith("data:image")) {
            return url;
        }

        console.log(`[IMAGE] Fetching reference image: ${url.substring(0, 80)}...`);

        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; VandaStudio/1.0)",
            },
        });

        if (!response.ok) {
            console.error(`[IMAGE] Failed to fetch image: ${response.status} ${response.statusText}`);
            return null;
        }

        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const contentType = response.headers.get("content-type") || "image/jpeg";

        console.log(`[IMAGE] Successfully fetched image: ${Math.round(buffer.byteLength / 1024)}KB, ${contentType}`);

        return `data:${contentType};base64,${base64}`;
    } catch (error) {
        console.error(`[IMAGE] Error fetching image:`, error instanceof Error ? error.message : error);
        return null;
    }
}

/**
 * Parse image from various response formats
 * OpenRouter returns images in: message.images[].image_url.url (base64 data URL)
 */
function parseImageFromResponse(data: unknown): ImageGenerationResponse | null {
    if (!data || typeof data !== "object") return null;

    const response = data as Record<string, unknown>;

    // Check choices array
    if (response.choices && Array.isArray(response.choices) && response.choices.length > 0) {
        const choice = response.choices[0] as Record<string, unknown>;
        const message = choice.message as Record<string, unknown> | undefined;

        if (message) {
            // OpenRouter image generation format: message.images[].image_url.url
            if (message.images && Array.isArray(message.images) && message.images.length > 0) {
                for (const imgWrapper of message.images) {
                    if (typeof imgWrapper !== "object" || !imgWrapper) continue;
                    const wrapper = imgWrapper as Record<string, unknown>;
                    
                    // Handle { type: "image_url", image_url: { url: "data:image/..." } }
                    if (wrapper.image_url && typeof wrapper.image_url === "object") {
                        const imageUrl = wrapper.image_url as Record<string, unknown>;
                        if (imageUrl.url && typeof imageUrl.url === "string") {
                            const result = parseDataUrl(imageUrl.url);
                            if (result) return result;
                        }
                    }
                    
                    // Direct base64 or data URL
                    const directResult = parseImageValue(imgWrapper);
                    if (directResult) return directResult;
                }
            }

            // Check message.content
            const content = message.content;

            // Array content (multimodal response)
            if (Array.isArray(content)) {
                for (const part of content) {
                    if (typeof part !== "object" || !part) continue;
                    const p = part as Record<string, unknown>;

                    // image_url format
                    if (p.type === "image_url" && p.image_url) {
                        const imageUrl = p.image_url as Record<string, unknown>;
                        const url = (typeof imageUrl === "string" ? imageUrl : imageUrl.url) as string | undefined;
                        if (url) {
                            const result = parseDataUrl(url);
                            if (result) return result;
                        }
                    }

                    // inline_data format (Gemini native)
                    if (p.inline_data && typeof p.inline_data === "object") {
                        const inlineData = p.inline_data as Record<string, unknown>;
                        if (inlineData.data && typeof inlineData.data === "string") {
                            return {
                                mimeType: (inlineData.mime_type as string) || "image/png",
                                imageBase64: inlineData.data,
                            };
                        }
                    }
                }
            }

            // String content (direct data URL)
            if (typeof content === "string" && content.startsWith("data:image")) {
                const result = parseDataUrl(content);
                if (result) return result;
            }
        }
    }

    // Check top-level images array
    if (response.images && Array.isArray(response.images) && response.images.length > 0) {
        const result = parseImageValue(response.images[0]);
        if (result) return result;
    }

    return null;
}

function parseImageValue(img: unknown): ImageGenerationResponse | null {
    if (typeof img === "string") {
        if (img.startsWith("data:image")) {
            return parseDataUrl(img);
        }
        // Assume raw base64
        return { mimeType: "image/png", imageBase64: img };
    }

    if (typeof img === "object" && img !== null) {
        const imgObj = img as Record<string, unknown>;

        // { image_url: { url: "..." } } or { image_url: "..." }
        if (imgObj.image_url) {
            const url = typeof imgObj.image_url === "string"
                ? imgObj.image_url
                : (imgObj.image_url as Record<string, unknown>).url as string | undefined;
            if (url) {
                const result = parseDataUrl(url);
                if (result) return result;
                // Raw base64 in url field
                return { mimeType: "image/png", imageBase64: url };
            }
        }

        // { url: "..." }
        if (imgObj.url && typeof imgObj.url === "string") {
            const result = parseDataUrl(imgObj.url);
            if (result) return result;
            return { mimeType: "image/png", imageBase64: imgObj.url };
        }

        // { data: "...", mime_type: "..." }
        if (imgObj.data && typeof imgObj.data === "string") {
            return {
                mimeType: (imgObj.mime_type as string) || (imgObj.mimeType as string) || "image/png",
                imageBase64: imgObj.data,
            };
        }

        // { b64_json: "..." }
        if (imgObj.b64_json && typeof imgObj.b64_json === "string") {
            return { mimeType: "image/png", imageBase64: imgObj.b64_json };
        }
    }

    return null;
}

function parseDataUrl(url: string): ImageGenerationResponse | null {
    if (!url.startsWith("data:image")) return null;
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (match && match[1] && match[2]) {
        return { mimeType: match[1], imageBase64: match[2] };
    }
    return null;
}



// ============================================================================
// Error Mapping
// ============================================================================

function mapImageGenerationError(error: unknown): AiError {
    // If it's already one of our errors, return it
    if (
        error instanceof ImageGenerationError ||
        error instanceof RateLimitError ||
        error instanceof ProviderError ||
        error instanceof NetworkError ||
        error instanceof MalformedResponseError
    ) {
        return error;
    }

    // Handle fetch/network errors
    if (error instanceof TypeError && String(error).includes("fetch")) {
        return new NetworkError({ cause: error });
    }

    // Handle AI SDK specific errors
    if (error instanceof Error) {
        const message = error.message.toLowerCase();

        // Model doesn't support image output
        if (
            message.includes("no endpoints found") ||
            message.includes("output modalities")
        ) {
            return new ImageGenerationError({
                reason: "Modelo não suporta geração de imagens neste formato",
            });
        }

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

export const ImageGenerationLive = Layer.effect(
    ImageGeneration,
    Effect.gen(function* () {
        const apiKey = yield* OpenRouterApiKey;
        const siteUrl = yield* SiteUrl;

        // Create OpenRouter client using AI SDK
        const openrouter = createOpenRouter({
            apiKey,
            headers: {
                "HTTP-Referer": siteUrl,
                "X-Title": "Vanda Studio",
            },
        });
        const getModel = (
            model: string,
            options?: Parameters<typeof openrouter.chat>[1]
        ): LanguageModel =>
            // Workaround for AI SDK/OpenRouter typing mismatch under exactOptionalPropertyTypes.
            openrouter.chat(model, options) as unknown as LanguageModel;

        return {
            generateImage: (params) =>
                Effect.tryPromise({
                    try: async () => {
                        const model = params.model ?? DEFAULT_IMAGE_MODEL;

                        // Calculate dimensions from aspect ratio and resolution
                        const aspectRatio = params.aspectRatio ?? "1:1";
                        const resolution = params.resolution ?? "standard";
                        const dimensions = calculateDimensions(aspectRatio, resolution);

                        console.log(`[IMAGE] Generating with model: ${model}`);
                        console.log(`[IMAGE] Size: ${dimensions.width}x${dimensions.height} (${aspectRatio}, ${resolution})`);

                        // Build multimodal content for AI SDK
                        type ImagePart = { type: "image"; image: string };
                        type TextPart = { type: "text"; text: string };
                        type ContentPart = ImagePart | TextPart;

                        const contentParts: ContentPart[] = [];

                        // Add reference images first
                        if (params.referenceImages && params.referenceImages.length > 0) {
                            console.log(`[IMAGE] Processing ${params.referenceImages.length} reference images...`);

                            let successCount = 0;
                            for (const img of params.referenceImages) {
                                const base64Data = await fetchImageAsBase64(img.url);
                                if (base64Data) {
                                    contentParts.push({
                                        type: "image",
                                        image: base64Data,
                                    });
                                    successCount++;
                                }
                            }

                            console.log(`[IMAGE] Successfully loaded ${successCount}/${params.referenceImages.length} reference images`);

                            if (successCount === 0 && params.referenceImages.length > 0) {
                                console.warn("[IMAGE] WARNING: No reference images could be loaded!");
                            }
                        }

                        // Add the text prompt
                        contentParts.push({
                            type: "text",
                            text: params.prompt,
                        });

                        // Map resolution to OpenRouter image_size
                        const imageSizeMap: Record<string, string> = {
                            standard: "1K",
                            high: "2K",
                            ultra: "4K",
                        };

                        // Get model capabilities
                        const capabilities = IMAGE_MODEL_CAPABILITIES[model as ImageModelName];
                        const supportsImageSize = capabilities?.supportsImageSize ?? false;
                        const outputModalities = capabilities?.outputModalities ?? ["image", "text"];

                        // Build image_config based on model capabilities
                        const imageConfig: Record<string, string> = {
                            aspect_ratio: aspectRatio,
                        };
                        if (supportsImageSize) {
                            imageConfig.image_size = imageSizeMap[resolution] ?? "1K";
                        }

                        console.log("[IMAGE] Calling OpenRouter API via AI SDK...");
                        console.log(`[IMAGE] Using modalities: ${JSON.stringify(outputModalities)}`);

                        // Use generateText with extraBody for image generation
                        const result = await generateText({
                            model: getModel(model, {
                                extraBody: {
                                    modalities: outputModalities,
                                    image_config: imageConfig,
                                },
                            }),
                            messages: [
                                {
                                    role: "user",
                                    content: contentParts,
                                },
                            ],
                        });

                        console.log("[IMAGE] Got response, parsing...");

                        let imageResult: ImageGenerationResponse | null = null;

                        // First, try to get image from SDK's files array (preferred method)
                        if (result.files && result.files.length > 0) {
                            const file = result.files[0];
                            if (file) {
                                console.log(`[IMAGE] Found ${result.files.length} file(s) in SDK response`);
                                imageResult = {
                                    imageBase64: file.base64,
                                    mimeType: file.mediaType || "image/png",
                                };
                            }
                        }

                        // Fallback: parse from response body (for providers that don't use files)
                        if (!imageResult) {
                            const responseBody = result.response?.body;
                            imageResult = parseImageFromResponse(responseBody);
                        }

                        if (!imageResult) {
                            console.error("[IMAGE] Failed to parse image from response");
                            console.error(
                                "[IMAGE] Response body:",
                                JSON.stringify(result.response?.body, null, 2)?.substring(0, 1000) ?? "undefined"
                            );
                            console.error("[IMAGE] Files array:", result.files);

                            throw new ImageGenerationError({
                                reason: "O modelo não retornou uma imagem válida",
                            });
                        }

                        console.log("[IMAGE] Successfully parsed image!");
                        console.log(
                            `[IMAGE] Image type: ${imageResult.mimeType}, size: ${imageResult.imageBase64.length} chars`
                        );

                        return {
                            ...imageResult,
                            dimensions,
                        };
                    },
                    catch: mapImageGenerationError,
                }),
        };
    })
);
