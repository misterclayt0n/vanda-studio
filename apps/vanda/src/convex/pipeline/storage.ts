import { v } from "convex/values";
import { signalSources } from "./constants";

/**
 * The Convex storage contract for `signals`, shared by the table definition
 * (`schema.ts`) and the insert mutation (`observe.ts`) so the durable shape
 * lives in exactly one place. A signal is a raw observation — `source` mirrors
 * the domain literal union; classification (kind/salience) is added later by
 * consolidate, not stored here.
 */
export const signalColumns = {
  accountId: v.id("accounts"),
  source: v.union(...signalSources.map((source) => v.literal(source))),
  externalId: v.string(),
  text: v.string(),
  authorHandle: v.optional(v.string()),
  permalink: v.optional(v.string()),
  observedAt: v.number(),
};
