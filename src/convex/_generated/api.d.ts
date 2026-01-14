/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_enhancedPostGeneration from "../ai/enhancedPostGeneration.js";
import type * as ai_llm_config from "../ai/llm/config.js";
import type * as ai_llm_errors from "../ai/llm/errors.js";
import type * as ai_llm_index from "../ai/llm/index.js";
import type * as ai_llm_models from "../ai/llm/models.js";
import type * as ai_llm_runtime from "../ai/llm/runtime.js";
import type * as ai_llm_services_ImageGeneration from "../ai/llm/services/ImageGeneration.js";
import type * as ai_llm_services_TextGeneration from "../ai/llm/services/TextGeneration.js";
import type * as ai_prompts from "../ai/prompts.js";
import type * as ai_regenerate from "../ai/regenerate.js";
import type * as billing_usage from "../billing/usage.js";
import type * as cleanup from "../cleanup.js";
import type * as files from "../files.js";
import type * as generatedPosts from "../generatedPosts.js";
import type * as generationHistory from "../generationHistory.js";
import type * as instagram from "../instagram.js";
import type * as instagramPosts from "../instagramPosts.js";
import type * as projects from "../projects.js";
import type * as referenceImages from "../referenceImages.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "ai/enhancedPostGeneration": typeof ai_enhancedPostGeneration;
  "ai/llm/config": typeof ai_llm_config;
  "ai/llm/errors": typeof ai_llm_errors;
  "ai/llm/index": typeof ai_llm_index;
  "ai/llm/models": typeof ai_llm_models;
  "ai/llm/runtime": typeof ai_llm_runtime;
  "ai/llm/services/ImageGeneration": typeof ai_llm_services_ImageGeneration;
  "ai/llm/services/TextGeneration": typeof ai_llm_services_TextGeneration;
  "ai/prompts": typeof ai_prompts;
  "ai/regenerate": typeof ai_regenerate;
  "billing/usage": typeof billing_usage;
  cleanup: typeof cleanup;
  files: typeof files;
  generatedPosts: typeof generatedPosts;
  generationHistory: typeof generationHistory;
  instagram: typeof instagram;
  instagramPosts: typeof instagramPosts;
  projects: typeof projects;
  referenceImages: typeof referenceImages;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
