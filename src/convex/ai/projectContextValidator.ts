import { v } from "convex/values";

/** Shared validator for brand context passed from the client into AI actions. */
export const projectContextValidator = v.optional(
    v.object({
        accountDescription: v.optional(v.string()),
        brandTraits: v.optional(v.array(v.string())),
        additionalContext: v.optional(v.string()),
        contextImageUrls: v.optional(v.array(v.string())),
        brandContextMarkdown: v.optional(v.string()),
    })
);
