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
