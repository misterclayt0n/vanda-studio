/**
 * Available AI models via OpenRouter
 */
export const MODELS = {
    // Analysis - fast and cost-effective
    GEMINI_2_5_FLASH: "google/gemini-2.5-flash",
    // Caption generation - high quality creative writing
    GPT_4_1: "openai/gpt-4.1",
    // Image generation (legacy - use IMAGE_MODELS instead)
    GEMINI_3_PRO_IMAGE: "google/gemini-3-pro-image-preview",
    // Web search - Perplexity Sonar has built-in web search
    PERPLEXITY_SONAR: "perplexity/sonar-pro",
    // Vision analysis - for analyzing images
    GEMINI_2_5_FLASH_VISION: "google/gemini-2.5-flash",
} as const;

export type ModelName = (typeof MODELS)[keyof typeof MODELS];

// Default model for analysis tasks
export const DEFAULT_MODEL = MODELS.GEMINI_2_5_FLASH;

// ============================================================================
// Image Generation Models
// ============================================================================

export const IMAGE_MODELS = {
    NANO_BANANA: "google/gemini-2.5-flash-image",
    NANO_BANANA_PRO: "google/gemini-3-pro-image-preview",
    SEEDREAM_4_5: "bytedance-seed/seedream-4.5",
    FLUX_2_FLEX: "black-forest-labs/flux.2-flex",
    GPT_IMAGE_1_5: "openai/gpt-5-image",
} as const;

export type ImageModelName = (typeof IMAGE_MODELS)[keyof typeof IMAGE_MODELS];

export const DEFAULT_IMAGE_MODEL = IMAGE_MODELS.NANO_BANANA_PRO;

/**
 * Model metadata for UI display
 */
export const IMAGE_MODEL_INFO: Record<
    ImageModelName,
    { name: string; provider: string; color: string }
> = {
    [IMAGE_MODELS.NANO_BANANA]: {
        name: "Nano Banana",
        provider: "Google",
        color: "#FACC15", // yellow
    },
    [IMAGE_MODELS.NANO_BANANA_PRO]: {
        name: "Nano Banana Pro",
        provider: "Google",
        color: "#FACC15", // yellow
    },
    [IMAGE_MODELS.SEEDREAM_4_5]: {
        name: "SeeDream v4.5",
        provider: "ByteDance",
        color: "#8B5CF6", // purple
    },
    [IMAGE_MODELS.FLUX_2_FLEX]: {
        name: "Flux 2 Flex",
        provider: "BFL",
        color: "#1F2937", // dark gray
    },
    [IMAGE_MODELS.GPT_IMAGE_1_5]: {
        name: "GPT Image 1.5",
        provider: "OpenAI",
        color: "#EC4899", // pink
    },
};
