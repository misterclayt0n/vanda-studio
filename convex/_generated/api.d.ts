/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_analysis from "../ai/analysis.js";
import type * as ai_analysisMutations from "../ai/analysisMutations.js";
import type * as ai_llm from "../ai/llm.js";
import type * as ai_postAnalysis from "../ai/postAnalysis.js";
import type * as ai_postGeneration from "../ai/postGeneration.js";
import type * as ai_prompts from "../ai/prompts.js";
import type * as billing_usage from "../billing/usage.js";
import type * as demo from "../demo.js";
import type * as demoUsage from "../demoUsage.js";
import type * as files from "../files.js";
import type * as generatedPosts from "../generatedPosts.js";
import type * as instagram from "../instagram.js";
import type * as instagramPosts from "../instagramPosts.js";
import type * as projects from "../projects.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "ai/analysis": typeof ai_analysis;
  "ai/analysisMutations": typeof ai_analysisMutations;
  "ai/llm": typeof ai_llm;
  "ai/postAnalysis": typeof ai_postAnalysis;
  "ai/postGeneration": typeof ai_postGeneration;
  "ai/prompts": typeof ai_prompts;
  "billing/usage": typeof billing_usage;
  demo: typeof demo;
  demoUsage: typeof demoUsage;
  files: typeof files;
  generatedPosts: typeof generatedPosts;
  instagram: typeof instagram;
  instagramPosts: typeof instagramPosts;
  projects: typeof projects;
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
