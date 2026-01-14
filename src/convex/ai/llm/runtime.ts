import { Effect, Layer, ManagedRuntime } from "effect";
import { TextGeneration, TextGenerationLive } from "./services/TextGeneration";
import { ImageGeneration, ImageGenerationLive } from "./services/ImageGeneration";
import { type AiError, type ConfigurationError, getErrorMessage } from "./errors";

// ============================================================================
// Layer Composition
// ============================================================================

/**
 * Combined layer providing all AI services
 */
export const AiLive = Layer.merge(TextGenerationLive, ImageGenerationLive);

/**
 * Type of services available in the AI layer
 */
export type AiServices = TextGeneration | ImageGeneration;

// ============================================================================
// Runtime
// ============================================================================

/**
 * Managed runtime for running Effects in Convex action context
 * Uses lazy initialization for layer caching
 */
let _runtime: ManagedRuntime.ManagedRuntime<
    TextGeneration | ImageGeneration,
    ConfigurationError
> | null = null;

function getRuntime(): ManagedRuntime.ManagedRuntime<
    TextGeneration | ImageGeneration,
    ConfigurationError
> {
    if (!_runtime) {
        _runtime = ManagedRuntime.make(AiLive);
    }
    return _runtime;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Run an Effect that uses AI services in Convex action context
 *
 * @example
 * ```typescript
 * const result = await runAiEffect(
 *   Effect.gen(function* () {
 *     const textGen = yield* TextGeneration;
 *     return yield* textGen.generateCaption({ messages: [...] });
 *   })
 * );
 * ```
 */
export async function runAiEffect<A, E extends AiError>(
    effect: Effect.Effect<A, E, TextGeneration | ImageGeneration>
): Promise<A> {
    const runtime = getRuntime();
    return runtime.runPromise(effect as Effect.Effect<A, E | ConfigurationError, TextGeneration | ImageGeneration>);
}

/**
 * Run an Effect and return Either for explicit error handling
 */
export async function runAiEffectEither<A, E extends AiError>(
    effect: Effect.Effect<A, E, TextGeneration | ImageGeneration>
): Promise<{ success: true; value: A } | { success: false; error: E | ConfigurationError }> {
    const runtime = getRuntime();
    const result = await runtime.runPromise(
        Effect.either(effect as Effect.Effect<A, E | ConfigurationError, TextGeneration | ImageGeneration>)
    );

    if (result._tag === "Right") {
        return { success: true, value: result.right };
    } else {
        return { success: false, error: result.left };
    }
}

/**
 * Run an Effect and convert errors to user-friendly PT-BR messages
 * Useful for returning errors directly to the client
 */
export async function runAiEffectWithUserError<A>(
    effect: Effect.Effect<A, AiError, TextGeneration | ImageGeneration>
): Promise<{ success: true; value: A } | { success: false; userMessage: string }> {
    const result = await runAiEffectEither(effect);

    if (result.success) {
        return result;
    } else {
        return { success: false, userMessage: getErrorMessage(result.error) };
    }
}

/**
 * Run an Effect or throw with a user-friendly error message
 */
export async function runAiEffectOrThrow<A>(
    effect: Effect.Effect<A, AiError, TextGeneration | ImageGeneration>
): Promise<A> {
    const result = await runAiEffectEither(effect);

    if (result.success) {
        return result.value;
    } else {
        throw new Error(getErrorMessage(result.error));
    }
}
