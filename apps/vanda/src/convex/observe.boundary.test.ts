// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import * as Effect from "effect/Effect";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import { signalsStoreLive } from "./pipeline/liveObserve";
import { observe } from "./pipeline/observe";
import { fakeAdapter } from "./pipeline/observe.testing";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("promoteConnection", () => {
  it("creates an account for a connection and is idempotent", async () => {
    const t = convexTest(schema, modules);
    const connectionId = await t.run(async (ctx) => {
      const now = Date.now();
      const userId = await ctx.db.insert("users", { name: "U", email: "u@e.com", clerkId: "c1" });
      return ctx.db.insert("instagramConnections", {
        userId,
        provider: "instagram_graph",
        status: "connected",
        externalAccountId: "ig1",
        lastConnectedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    const first = await t.mutation(internal.observe.promoteConnection, {
      connectionId,
      mode: "auto",
    });
    const second = await t.mutation(internal.observe.promoteConnection, { connectionId });
    expect(second).toBe(first); // idempotent: one account per connection

    const account = await t.run((ctx) => ctx.db.get(first));
    expect(account!.mode).toBe("auto");
    expect(account!.connectionId).toBe(connectionId);
  });
});

describe("observe through the ctx-backed signals store", () => {
  it("persists fetched signals and dedups on a second pass", async () => {
    const t = convexTest(schema, modules);
    const accountId = await t.run(async (ctx) => {
      const now = Date.now();
      return ctx.db.insert("accounts", { mode: "auto", createdAt: now, updatedAt: now });
    });
    const adapters = [
      fakeAdapter("comments", [
        { externalId: "c1", text: "hi", observedAt: 1 },
        { externalId: "c2", text: "yo", observedAt: 2 },
      ]),
    ];
    const runObserve = () =>
      t.action(async (ctx) =>
        Effect.runPromise(observe(accountId, adapters).pipe(Effect.provide(signalsStoreLive(ctx)))),
      );

    const first = await runObserve();
    expect(first).toHaveLength(2);

    const second = await runObserve(); // same externalIds => fully deduped
    expect(second).toHaveLength(0);

    // feed is most-recent-first by observedAt
    const feed = await t.query(internal.observe.listRecentSignals, { accountId });
    expect(feed.map((signal) => signal.externalId)).toEqual(["c2", "c1"]);
  });
});
