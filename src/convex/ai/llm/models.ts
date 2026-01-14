/**
 * Available AI models via OpenRouter
 */
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

export type ModelName = (typeof MODELS)[keyof typeof MODELS];

// Default model for analysis tasks
export const DEFAULT_MODEL = MODELS.GEMINI_2_5_FLASH;
