import { Config, Effect } from "effect";
import { ConfigurationError } from "./errors";

/**
 * OpenRouter API Key configuration
 * Required for all AI operations
 */
export const OpenRouterApiKey: Effect.Effect<string, ConfigurationError> = Effect.gen(function* () {
    const config = Config.string("OPENROUTER_API_KEY");
    const result = yield* Effect.either(config);

    if (result._tag === "Left") {
        return yield* Effect.fail(new ConfigurationError({ key: "OPENROUTER_API_KEY" }));
    }

    if (!result.right || result.right.trim() === "") {
        return yield* Effect.fail(new ConfigurationError({ key: "OPENROUTER_API_KEY" }));
    }

    return result.right;
});

/**
 * Site URL configuration
 * Used for HTTP-Referer header (required by OpenRouter)
 * Defaults to https://vanda.studio if not set
 */
export const SiteUrl: Effect.Effect<string, never> = Effect.succeed(
    process.env.SITE_URL || "https://vanda.studio"
);
