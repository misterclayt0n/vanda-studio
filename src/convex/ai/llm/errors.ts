import { Data } from "effect";

/**
 * Error when required environment variables are missing
 */
export class ConfigurationError extends Data.TaggedError("ConfigurationError")<{
    readonly key: string;
}> {
    get userMessage(): string {
        return "Erro de configuração do servidor. Por favor, tente novamente mais tarde.";
    }
}

/**
 * Error when API rate limit is exceeded
 */
export class RateLimitError extends Data.TaggedError("RateLimitError")<{
    readonly retryAfter?: number;
}> {
    get userMessage(): string {
        return "Muitas requisições. Por favor, aguarde alguns segundos e tente novamente.";
    }
}

/**
 * Error when AI response cannot be parsed
 */
export class MalformedResponseError extends Data.TaggedError("MalformedResponseError")<{
    readonly rawResponse: string;
    readonly parseError?: string;
}> {
    get userMessage(): string {
        return "Resposta inválida do modelo de IA. Por favor, tente novamente.";
    }
}

/**
 * Error specific to image generation failures
 */
export class ImageGenerationError extends Data.TaggedError("ImageGenerationError")<{
    readonly reason: string;
}> {
    get userMessage(): string {
        return "Falha ao gerar imagem. Por favor, tente novamente.";
    }
}

/**
 * Error for network/connection issues
 */
export class NetworkError extends Data.TaggedError("NetworkError")<{
    readonly cause: unknown;
}> {
    get userMessage(): string {
        return "Erro de conexão. Verifique sua internet e tente novamente.";
    }
}

/**
 * Error when AI provider returns an error response
 */
export class ProviderError extends Data.TaggedError("ProviderError")<{
    readonly status: number;
    readonly message: string;
}> {
    get userMessage(): string {
        if (this.status === 429) {
            return "Muitas requisições. Por favor, aguarde alguns segundos e tente novamente.";
        }
        if (this.status >= 500) {
            return "O serviço de IA está temporariamente indisponível. Tente novamente em alguns minutos.";
        }
        return "Erro ao processar sua solicitação. Por favor, tente novamente.";
    }
}

/**
 * Union type of all AI-related errors
 */
export type AiError =
    | ConfigurationError
    | RateLimitError
    | MalformedResponseError
    | ImageGenerationError
    | NetworkError
    | ProviderError;

/**
 * Extract user-friendly error message from any AiError
 */
export function getErrorMessage(error: AiError): string {
    return error.userMessage;
}
