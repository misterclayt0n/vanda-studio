// ============================================================================
// Public API for AI/LLM module
// ============================================================================

// Services
export { TextGeneration, TextGenerationLive } from "./services/TextGeneration";
export type {
    CaptionResponse,
    ChatMessage,
    GenerateTextParams,
    GenerateStructuredParams,
} from "./services/TextGeneration";

export { ImageGeneration, ImageGenerationLive } from "./services/ImageGeneration";
export type {
    ReferenceImage,
    ImageGenerationParams,
    ImageGenerationResponse,
} from "./services/ImageGeneration";

// Errors
export {
    ConfigurationError,
    RateLimitError,
    MalformedResponseError,
    ImageGenerationError,
    NetworkError,
    ProviderError,
    getErrorMessage,
} from "./errors";
export type { AiError } from "./errors";

// Config
export { OpenRouterApiKey, SiteUrl } from "./config";

// Models
export {
    MODELS,
    DEFAULT_MODEL,
    IMAGE_MODELS,
    DEFAULT_IMAGE_MODEL,
    IMAGE_MODEL_INFO,
} from "./models";
export type { ModelName, ImageModelName } from "./models";

// Types (aspect ratio, resolution, dimensions)
export {
    ASPECT_RATIOS,
    ASPECT_RATIO_LIST,
    RESOLUTIONS,
    RESOLUTION_LIST,
    calculateDimensions,
    formatDimensions,
    getSizeString,
} from "./types";
export type { AspectRatio, Resolution, Dimensions } from "./types";

// Runtime
export {
    AiLive,
    runAiEffect,
    runAiEffectEither,
    runAiEffectWithUserError,
    runAiEffectOrThrow,
} from "./runtime";
export type { AiServices } from "./runtime";
