"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Available models via OpenRouter
export const MODELS = {
    // Analysis - fast and cost-effective
    GEMINI_2_5_FLASH: "google/gemini-2.5-flash",
    // Caption generation - high quality creative writing
    GPT_4_1: "openai/gpt-4.1",
    // Image generation
    GEMINI_3_PRO_IMAGE: "google/gemini-3-pro-image-preview",
    // Web search - Perplexity Sonar has built-in web search
    PERPLEXITY_SONAR: "perplexity/sonar-pro",
    // Vision analysis - for analyzing images
    GEMINI_2_5_FLASH_VISION: "google/gemini-2.5-flash",
} as const;

// Default model for analysis tasks
const DEFAULT_MODEL = MODELS.GEMINI_2_5_FLASH;

interface LLMResponse {
    content: string;
    tokensUsed: number;
    model: string;
}

interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export async function callLLM(
    messages: ChatMessage[],
    options?: {
        model?: string;
        maxTokens?: number;
        temperature?: number;
        jsonMode?: boolean;
    }
): Promise<LLMResponse> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY environment variable is not set");
    }

    const model = options?.model ?? DEFAULT_MODEL;

    const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": process.env.SITE_URL ?? "https://vanda.studio",
            "X-Title": "Vanda Studio",
        },
        body: JSON.stringify({
            model,
            messages,
            max_tokens: options?.maxTokens ?? 4096,
            temperature: options?.temperature ?? 0.7,
            ...(options?.jsonMode && {
                response_format: { type: "json_object" },
            }),
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
        throw new Error("No response from OpenRouter API");
    }

    const content = data.choices[0].message?.content ?? "";
    const tokensUsed = (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0);

    return {
        content,
        tokensUsed,
        model: data.model ?? model,
    };
}

// Helper to parse JSON from LLM response
export function parseJSONResponse<T>(response: string): T {
    // Try to extract JSON from the response
    // Sometimes LLMs wrap JSON in markdown code blocks
    let jsonStr = response.trim();

    // Remove markdown code blocks if present (handle both complete and incomplete blocks)
    // First try to match complete code blocks
    const completeMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (completeMatch) {
        jsonStr = completeMatch[1].trim();
    } else {
        // Handle incomplete code blocks (LLM response was truncated)
        const incompleteMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*)/);
        if (incompleteMatch) {
            jsonStr = incompleteMatch[1].trim();
        }
    }

    // Try to find JSON object boundaries if the response has extra content
    const jsonStartIndex = jsonStr.indexOf('{');
    const jsonEndIndex = jsonStr.lastIndexOf('}');

    if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
        jsonStr = jsonStr.substring(jsonStartIndex, jsonEndIndex + 1);
    }

    try {
        return JSON.parse(jsonStr) as T;
    } catch (error) {
        // If parsing fails, try to repair common issues
        try {
            // Sometimes JSON is truncated - try to complete it
            const repaired = tryRepairJSON(jsonStr);
            return JSON.parse(repaired) as T;
        } catch {
            throw new Error(`Failed to parse JSON response: ${error}. Raw response: ${response.substring(0, 500)}`);
        }
    }
}

// Attempt to repair truncated or malformed JSON
function tryRepairJSON(jsonStr: string): string {
    let repaired = jsonStr;

    // Count brackets to see if we need to close any
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escapeNext = false;

    for (const char of repaired) {
        if (escapeNext) {
            escapeNext = false;
            continue;
        }
        if (char === '\\') {
            escapeNext = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            continue;
        }
        if (!inString) {
            if (char === '{') openBraces++;
            else if (char === '}') openBraces--;
            else if (char === '[') openBrackets++;
            else if (char === ']') openBrackets--;
        }
    }

    // If we're in a string, close it
    if (inString) {
        repaired += '"';
    }

    // Close any open brackets/braces
    while (openBrackets > 0) {
        repaired += ']';
        openBrackets--;
    }
    while (openBraces > 0) {
        repaired += '}';
        openBraces--;
    }

    return repaired;
}

// Image generation response
interface ImageGenerationResponse {
    imageBase64: string;
    mimeType: string;
}

// Reference image for context
interface ReferenceImage {
    url: string;  // Can be a URL or data:image/...;base64,... format
    description?: string;
}

// Fetch an image from URL and convert to base64 data URL
async function fetchImageAsBase64(url: string): Promise<string | null> {
    try {
        // Skip if already a data URL
        if (url.startsWith("data:image")) {
            return url;
        }

        console.log(`[IMAGE] Fetching reference image: ${url.substring(0, 80)}...`);
        
        const response = await fetch(url, {
            headers: {
                // Some CDNs need a user agent
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

// Generate image using Gemini 3 Pro Image model
export async function generateImage(
    prompt: string,
    options?: {
        model?: string;
        referenceImages?: ReferenceImage[];
    }
): Promise<ImageGenerationResponse> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY environment variable is not set");
    }

    const model = options?.model ?? MODELS.GEMINI_3_PRO_IMAGE;

    // Build multimodal content array
    const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

    // Add reference images first (up to 5 for identity preservation)
    // CRITICAL: We fetch and convert to base64 because Instagram CDN URLs are protected
    if (options?.referenceImages && options.referenceImages.length > 0) {
        const imagesToUse = options.referenceImages; // Use ALL reference images for maximum brand context
        console.log(`[IMAGE] Processing ${imagesToUse.length} reference images...`);
        
        let successCount = 0;
        for (const img of imagesToUse) {
            const base64Data = await fetchImageAsBase64(img.url);
            if (base64Data) {
                contentParts.push({
                    type: "image_url",
                    image_url: { url: base64Data },
                });
                successCount++;
            }
        }
        
        console.log(`[IMAGE] Successfully loaded ${successCount}/${imagesToUse.length} reference images`);
        
        if (successCount === 0 && imagesToUse.length > 0) {
            console.warn("[IMAGE] WARNING: No reference images could be loaded! Image will be generated without brand context.");
        }
    }

    // Add the text prompt
    const imagePrompt = `Generate an image: ${prompt}`;
    contentParts.push({
        type: "text",
        text: imagePrompt,
    });

    const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": process.env.SITE_URL ?? "https://vanda.studio",
            "X-Title": "Vanda Studio",
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: "user",
                    content: contentParts,
                },
            ],
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
        throw new Error("No response from OpenRouter API");
    }

    const choice = data.choices[0];
    const message = choice.message;
    const content = message?.content;

    // Check for images in message.images (OpenRouter/Gemini format)
    if (message?.images && Array.isArray(message.images) && message.images.length > 0) {
        const img = message.images[0];

        // Check different possible formats
        if (typeof img === "string") {
            // Could be base64 or data URL
            if (img.startsWith("data:image")) {
                const match = img.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                    return {
                        mimeType: match[1],
                        imageBase64: match[2],
                    };
                }
            }
            // Assume raw base64
            return {
                mimeType: "image/png",
                imageBase64: img,
            };
        }

        // Object format with url or data
        if (typeof img === "object" && img !== null) {
            // Format: { type: "image_url", image_url: { url: "data:image/png;base64,..." } }
            if (img.image_url) {
                const imageUrl = typeof img.image_url === "string" ? img.image_url : img.image_url.url;
                if (imageUrl) {
                    if (imageUrl.startsWith("data:image")) {
                        const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
                        if (match) {
                            return {
                                mimeType: match[1],
                                imageBase64: match[2],
                            };
                        }
                    }
                    // Raw base64
                    return {
                        mimeType: "image/png",
                        imageBase64: imageUrl,
                    };
                }
            }
            // Format: { url: "data:image/png;base64,..." }
            if (img.url && typeof img.url === "string") {
                if (img.url.startsWith("data:image")) {
                    const match = img.url.match(/^data:([^;]+);base64,(.+)$/);
                    if (match) {
                        return {
                            mimeType: match[1],
                            imageBase64: match[2],
                        };
                    }
                }
                // Raw base64 in url field
                return {
                    mimeType: "image/png",
                    imageBase64: img.url,
                };
            }
            // Format: { data: "base64...", mime_type: "image/png" }
            if (img.data && typeof img.data === "string") {
                return {
                    mimeType: img.mime_type || img.mimeType || "image/png",
                    imageBase64: img.data,
                };
            }
            // Format: { b64_json: "base64..." }
            if (img.b64_json && typeof img.b64_json === "string") {
                return {
                    mimeType: "image/png",
                    imageBase64: img.b64_json,
                };
            }
        }
    }

    // Handle array content (multimodal response)
    if (Array.isArray(content)) {
        for (const part of content) {
            // OpenRouter format: image_url with data URL
            if (part.type === "image_url" && part.image_url?.url) {
                const dataUrl = part.image_url.url;
                const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                    return {
                        mimeType: match[1],
                        imageBase64: match[2],
                    };
                }
            }
            // Gemini native format: inline_data
            if (part.inline_data) {
                return {
                    mimeType: part.inline_data.mime_type || "image/png",
                    imageBase64: part.inline_data.data,
                };
            }
            // Text part with base64 image
            if (part.type === "text" && typeof part.text === "string" && part.text.startsWith("data:image")) {
                const match = part.text.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                    return {
                        mimeType: match[1],
                        imageBase64: match[2],
                    };
                }
            }
        }
    }

    // Check if content is a string with data URL
    if (typeof content === "string" && content.startsWith("data:image")) {
        const match = content.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
            return {
                mimeType: match[1],
                imageBase64: match[2],
            };
        }
    }

    // Check for image in other parts of the response
    // Some models return images in a separate 'images' array
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
        const img = data.images[0];
        if (typeof img === "string") {
            if (img.startsWith("data:image")) {
                const match = img.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                    return {
                        mimeType: match[1],
                        imageBase64: match[2],
                    };
                }
            }
            // Assume raw base64
            return {
                mimeType: "image/png",
                imageBase64: img,
            };
        }
    }

    throw new Error("Falha ao gerar imagem. O modelo nao retornou uma imagem valida.");
}

// Vision-enabled LLM call for analyzing images
export async function callVisionLLM(
    prompt: string,
    imageUrls: string[],
    options?: {
        model?: string;
        maxTokens?: number;
        temperature?: number;
        jsonMode?: boolean;
    }
): Promise<LLMResponse> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY environment variable is not set");
    }

    const model = options?.model ?? MODELS.GEMINI_2_5_FLASH_VISION;

    // Build multimodal content array
    const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

    // Add images first
    console.log(`[VISION] Processing ${imageUrls.length} images for analysis...`);
    let successCount = 0;
    
    for (const url of imageUrls) {
        const base64Data = await fetchImageAsBase64(url);
        if (base64Data) {
            contentParts.push({
                type: "image_url",
                image_url: { url: base64Data },
            });
            successCount++;
        }
    }
    
    console.log(`[VISION] Successfully loaded ${successCount}/${imageUrls.length} images`);

    // Add the text prompt
    contentParts.push({
        type: "text",
        text: prompt,
    });

    const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": process.env.SITE_URL ?? "https://vanda.studio",
            "X-Title": "Vanda Studio",
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: "user",
                    content: contentParts,
                },
            ],
            max_tokens: options?.maxTokens ?? 2048,
            temperature: options?.temperature ?? 0.5,
            ...(options?.jsonMode && {
                response_format: { type: "json_object" },
            }),
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
        throw new Error("No response from OpenRouter API");
    }

    const content = data.choices[0].message?.content ?? "";
    const tokensUsed = (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0);

    return {
        content,
        tokensUsed,
        model: data.model ?? model,
    };
}

// Convex action wrapper for testing LLM connection
export const testConnection = action({
    args: {},
    handler: async (): Promise<{ success: boolean; message: string }> => {
        try {
            const result = await callLLM([
                { role: "user", content: "Say 'connected' and nothing else." }
            ], {
                maxTokens: 10,
                temperature: 0,
            });

            return {
                success: true,
                message: `Connected! Model: ${result.model}, Response: ${result.content}`,
            };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : "Unknown error",
            };
        }
    },
});
