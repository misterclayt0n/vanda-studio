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
export { MODELS, DEFAULT_MODEL } from "./models";
export type { ModelName } from "./models";

// Runtime
export {
    AiLive,
    runAiEffect,
    runAiEffectEither,
    runAiEffectWithUserError,
    runAiEffectOrThrow,
} from "./runtime";
export type { AiServices } from "./runtime";
