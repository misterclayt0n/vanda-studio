import { v } from "convex/values";

/** Convex validator + shared shape for project brand kit (structured fields). */
export const brandKitValidator = v.object({
    elevatorPitch: v.optional(v.string()),
    whatWeSell: v.optional(v.string()),
    whoWeServe: v.optional(v.string()),
    differentiators: v.optional(v.string()),
    competitorsNotes: v.optional(v.string()),
    toneAdjectives: v.optional(v.array(v.string())),
    writingRules: v.optional(v.string()),
    languages: v.optional(v.array(v.string())),
    emojiPolicy: v.optional(v.string()),
    ctaStyle: v.optional(v.string()),
    primaryColors: v.optional(v.array(v.string())),
    secondaryColors: v.optional(v.array(v.string())),
    typographyPrimary: v.optional(v.string()),
    typographySecondary: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    imageryGuidelines: v.optional(v.string()),
    lastWebsiteIngestUrl: v.optional(v.string()),
    lastWebsiteIngestAt: v.optional(v.number()),
    lastAiFillAt: v.optional(v.number()),
    ingestSummarySnippet: v.optional(v.string()),
});

export const onboardingPathValidator = v.union(v.literal("existing"), v.literal("new"));
export const onboardingStatusValidator = v.union(v.literal("draft"), v.literal("complete"));
