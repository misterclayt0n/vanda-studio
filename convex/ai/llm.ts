"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Default model - can be overridden per call
// Using Gemini 2.5 Flash for cost efficiency
const DEFAULT_MODEL = "google/gemini-2.5-flash-preview";

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
    let jsonStr = response;

    // Remove markdown code blocks if present
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
    }

    try {
        return JSON.parse(jsonStr) as T;
    } catch (error) {
        throw new Error(`Failed to parse JSON response: ${error}. Raw response: ${response.substring(0, 500)}`);
    }
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
