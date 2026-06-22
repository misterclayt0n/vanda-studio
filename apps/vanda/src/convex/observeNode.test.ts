// @vitest-environment node
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("observeAccount", () => {
  it("is a no-op when the account has no connection", async () => {
    const t = convexTest(schema, modules);
    const accountId = await t.run(async (ctx) => {
      const now = Date.now();
      return ctx.db.insert("accounts", { mode: "manual", createdAt: now, updatedAt: now });
    });

    await t.action(internal.observeNode.observeAccount, { accountId });

    const feed = await t.query(internal.observe.listRecentSignals, { accountId });
    expect(feed).toHaveLength(0);
  });
});
