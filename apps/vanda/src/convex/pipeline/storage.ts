import { v } from "convex/values";

/**
 * The Convex storage contract for `signals`, shared by the table definition
 * (`schema.ts`) and the insert mutation (`spike.ts`) so the durable shape lives
 * in exactly one place. `kind` and `source` mirror the domain literal unions
 * rather than bare strings, keeping persistence as tight as the pipeline's
 * in-memory types. (`source` widens to a union when later phases add sources.)
 */
export const signalColumns = {
  externalId: v.string(),
  accountExternalId: v.string(),
  source: v.literal("comments"),
  kind: v.union(
    v.literal("praise"),
    v.literal("question"),
    v.literal("complaint"),
    v.literal("other"),
  ),
  text: v.string(),
  salience: v.number(),
  observedAt: v.number(),
};
