/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_agents_caption from "../ai/agents/caption.js";
import type * as ai_agents_image from "../ai/agents/image.js";
import type * as ai_agents_index from "../ai/agents/index.js";
import type * as ai_chat from "../ai/chat.js";
import type * as ai_imageEdit from "../ai/imageEdit.js";
import type * as ai_llm_config from "../ai/llm/config.js";
import type * as ai_llm_errors from "../ai/llm/errors.js";
import type * as ai_llm_index from "../ai/llm/index.js";
import type * as ai_llm_models from "../ai/llm/models.js";
import type * as ai_llm_runtime from "../ai/llm/runtime.js";
import type * as ai_llm_services_ImageGeneration from "../ai/llm/services/ImageGeneration.js";
import type * as ai_llm_services_TextGeneration from "../ai/llm/services/TextGeneration.js";
import type * as ai_llm_types from "../ai/llm/types.js";
import type * as ai_profileAnalysis from "../ai/profileAnalysis.js";
import type * as billing_abacatepay from "../billing/abacatepay.js";
import type * as billing_usage from "../billing/usage.js";
import type * as chatMessages from "../chatMessages.js";
import type * as cleanup from "../cleanup.js";
import type * as contextImages from "../contextImages.js";
import type * as crons from "../crons.js";
import type * as files from "../files.js";
import type * as generatedImages from "../generatedImages.js";
import type * as generatedPosts from "../generatedPosts.js";
import type * as generationHistory from "../generationHistory.js";
import type * as googleCalendar from "../googleCalendar.js";
import type * as http from "../http.js";
import type * as imageEditConversations from "../imageEditConversations.js";
import type * as imageEditOutputs from "../imageEditOutputs.js";
import type * as imageEditTurns from "../imageEditTurns.js";
import type * as instagram from "../instagram.js";
import type * as instagramPosts from "../instagramPosts.js";
import type * as projects from "../projects.js";
import type * as referenceImages from "../referenceImages.js";
import type * as scheduledPosts from "../scheduledPosts.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "ai/agents/caption": typeof ai_agents_caption;
  "ai/agents/image": typeof ai_agents_image;
  "ai/agents/index": typeof ai_agents_index;
  "ai/chat": typeof ai_chat;
  "ai/imageEdit": typeof ai_imageEdit;
  "ai/llm/config": typeof ai_llm_config;
  "ai/llm/errors": typeof ai_llm_errors;
  "ai/llm/index": typeof ai_llm_index;
  "ai/llm/models": typeof ai_llm_models;
  "ai/llm/runtime": typeof ai_llm_runtime;
  "ai/llm/services/ImageGeneration": typeof ai_llm_services_ImageGeneration;
  "ai/llm/services/TextGeneration": typeof ai_llm_services_TextGeneration;
  "ai/llm/types": typeof ai_llm_types;
  "ai/profileAnalysis": typeof ai_profileAnalysis;
  "billing/abacatepay": typeof billing_abacatepay;
  "billing/usage": typeof billing_usage;
  chatMessages: typeof chatMessages;
  cleanup: typeof cleanup;
  contextImages: typeof contextImages;
  crons: typeof crons;
  files: typeof files;
  generatedImages: typeof generatedImages;
  generatedPosts: typeof generatedPosts;
  generationHistory: typeof generationHistory;
  googleCalendar: typeof googleCalendar;
  http: typeof http;
  imageEditConversations: typeof imageEditConversations;
  imageEditOutputs: typeof imageEditOutputs;
  imageEditTurns: typeof imageEditTurns;
  instagram: typeof instagram;
  instagramPosts: typeof instagramPosts;
  projects: typeof projects;
  referenceImages: typeof referenceImages;
  scheduledPosts: typeof scheduledPosts;
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
