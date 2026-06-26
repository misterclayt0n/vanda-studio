// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("accounts.listMine — the owner's businesses", () => {
  it("returns only my accounts, names defaulted from the IG connection", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const { withName, override } = await t.run(async (ctx) => {
      const me = await ctx.db.insert("users", { name: "Me", email: "me@e.com", clerkId: "me" });
      const other = await ctx.db.insert("users", { name: "O", email: "o@e.com", clerkId: "other" });
      const conn = await ctx.db.insert("instagramConnections", {
        userId: me,
        provider: "instagram_graph",
        status: "connected",
        externalAccountId: "ig1",
        externalAccountName: "Café Lumiar",
        handle: "cafelumiar",
        lastConnectedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      const withName = await ctx.db.insert("accounts", {
        ownerUserId: me,
        connectionId: conn,
        mode: "auto",
        createdAt: now,
        updatedAt: now,
      });
      const override = await ctx.db.insert("accounts", {
        ownerUserId: me,
        name: "Segundo Negócio",
        mode: "needs_approval",
        createdAt: now,
        updatedAt: now,
      });
      // Another owner's account must never surface in my switcher.
      await ctx.db.insert("accounts", {
        ownerUserId: other,
        mode: "auto",
        createdAt: now,
        updatedAt: now,
      });
      return { withName, override };
    });

    const rows = await t.withIdentity({ subject: "me" }).query(api.accounts.listMine, {});
    expect(rows).toHaveLength(2);
    const find = (id: string) => rows.find((r) => r.id === id)!;
    expect(find(withName).name).toBe("Café Lumiar"); // defaults from the connection
    expect(find(withName).connected).toBe(true);
    expect(find(override).name).toBe("Segundo Negócio"); // explicit override wins
    expect(find(override).connected).toBe(false);
  });

  it("returns [] when signed out", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.accounts.listMine, {})).toEqual([]);
  });
});

describe("accounts.setMode", () => {
  it("updates a mode the caller owns and rejects another owner's account", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const { mine, theirs } = await t.run(async (ctx) => {
      const me = await ctx.db.insert("users", { name: "Me", email: "me@e.com", clerkId: "me" });
      const other = await ctx.db.insert("users", { name: "O", email: "o@e.com", clerkId: "other" });
      const mine = await ctx.db.insert("accounts", {
        ownerUserId: me,
        mode: "auto",
        createdAt: now,
        updatedAt: now,
      });
      const theirs = await ctx.db.insert("accounts", {
        ownerUserId: other,
        mode: "auto",
        createdAt: now,
        updatedAt: now,
      });
      return { mine, theirs };
    });

    const asMe = t.withIdentity({ subject: "me" });
    await asMe.mutation(api.accounts.setMode, { accountId: mine, mode: "manual" });
    expect((await t.run((ctx) => ctx.db.get(mine)))!.mode).toBe("manual");

    await expect(
      asMe.mutation(api.accounts.setMode, { accountId: theirs, mode: "manual" }),
    ).rejects.toThrow();
  });
});
