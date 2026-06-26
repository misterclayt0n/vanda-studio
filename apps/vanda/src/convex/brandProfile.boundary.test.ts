// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

/** A representative edited analysis the owner approves (mutable — these are mutation args). */
const analysis = {
  identity: {
    text: "Café Lumiar — cafeteria pet-friendly em Pinheiros",
    evidence: "Do perfil e bio",
    confidence: 0.95,
  },
  summary: {
    text: "Cafeteria pet-friendly em Pinheiros, de tom acolhedor.",
    evidence: "Síntese de 18 posts",
    confidence: 0.9,
  },
  voice: {
    items: ["acolhedor", "informal", "local", "afetuoso com pets"],
    evidence: "Detectado em 18 posts",
    confidence: 0.9,
  },
  themes: {
    items: ["café especial", "inverno", "dogs", "clientes fiéis"],
    evidence: "Aparecem em 12 posts recentes",
    confidence: 0.6,
  },
  characters: {
    items: ["golden retriever", "baristas", "clientes com pets"],
    evidence: "Citados em 7 comentários",
    confidence: 0.4,
  },
  restrictions: {
    items: ["evitar promessas médicas", "evitar temas políticos"],
    evidence: "Sugestão da Vanda",
    confidence: 0.3,
  },
  opportunities: {
    items: ["combo de inverno", "posts com cachorro", "bastidores"],
    evidence: "Baseado no que mais engaja",
    confidence: 0.6,
  },
};

const setup = async (clerkId = "c1") => {
  const t = convexTest(schema, modules);
  const accountId = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Marina", email: "m@e.com", clerkId });
    return ctx.db.insert("accounts", {
      ownerUserId: userId,
      mode: "needs_approval",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
  return { t, accountId };
};

describe("approveBrandProfile", () => {
  it("writes confirmed canon, seeds themes, and stamps onboardedAt", async () => {
    const { t, accountId } = await setup();
    await t
      .withIdentity({ subject: "c1" })
      .mutation(api.brandProfile.approveBrandProfile, { accountId, ...analysis });

    const canon = await t.run((ctx) => ctx.db.query("brandCanon").collect());
    const ofKind = (kind: string) => canon.filter((c) => c.kind === kind);
    expect(canon).toHaveLength(11); // 1 identity + 1 summary + 4 voice + 3 character + 2 restriction
    expect(ofKind("identity")).toHaveLength(1);
    expect(ofKind("summary")).toHaveLength(1);
    expect(ofKind("voice")).toHaveLength(4);
    expect(ofKind("character")).toHaveLength(3);
    expect(ofKind("restriction")).toHaveLength(2);
    expect(canon.every((c) => c.confirmedByOwner)).toBe(true);
    // themes/opportunities are NOT canon — they materialize elsewhere.
    expect(ofKind("theme")).toHaveLength(0);
    expect(ofKind("opportunity")).toHaveLength(0);

    const themes = await t.run((ctx) => ctx.db.query("themes").collect());
    const themeNames = themes.map((th) => th.name);
    expect(themeNames).toHaveLength(4);
    expect(themeNames).toEqual(
      expect.arrayContaining(["café especial", "clientes fiéis", "dogs", "inverno"]),
    );
    expect(themes.every((th) => th.momentum === "steady")).toBe(true);

    // Opportunities are previews only — onboarding never hand-seeds suggestions.
    const suggestions = await t.run((ctx) => ctx.db.query("suggestions").collect());
    expect(suggestions).toHaveLength(0);

    const account = await t.run((ctx) => ctx.db.get(accountId));
    expect(account?.onboardedAt).toBeTypeOf("number");
  });

  it("upserts themes by name instead of duplicating an existing one", async () => {
    const { t, accountId } = await setup();
    await t.run((ctx) =>
      ctx.db.insert("themes", {
        accountId,
        name: "dogs",
        summary: "existing",
        momentum: "rising",
        postCount: 3,
        signalCount: 9,
      }),
    );
    await t
      .withIdentity({ subject: "c1" })
      .mutation(api.brandProfile.approveBrandProfile, { accountId, ...analysis });

    const dogs = await t.run((ctx) =>
      ctx.db
        .query("themes")
        .collect()
        .then((rows) => rows.filter((r) => r.name === "dogs")),
    );
    expect(dogs).toHaveLength(1);
    expect(dogs[0]!.momentum).toBe("rising"); // the existing row is preserved, not overwritten
  });

  it("rejects approval from a non-owner", async () => {
    const { t, accountId } = await setup();
    await t.run((ctx) =>
      ctx.db.insert("users", { name: "Other", email: "o@e.com", clerkId: "c2" }),
    );
    await expect(
      t
        .withIdentity({ subject: "c2" })
        .mutation(api.brandProfile.approveBrandProfile, { accountId, ...analysis }),
    ).rejects.toThrow();
  });

  it("rejects a second approve (single-use onboarding)", async () => {
    const { t, accountId } = await setup();
    const owner = t.withIdentity({ subject: "c1" });
    await owner.mutation(api.brandProfile.approveBrandProfile, { accountId, ...analysis });
    await expect(
      owner.mutation(api.brandProfile.approveBrandProfile, { accountId, ...analysis }),
    ).rejects.toThrow();
  });

  it("getBrandCanon returns the owner's confirmed canon", async () => {
    const { t, accountId } = await setup();
    const owner = t.withIdentity({ subject: "c1" });
    await owner.mutation(api.brandProfile.approveBrandProfile, { accountId, ...analysis });
    const canon = await owner.query(api.brandProfile.getBrandCanon, { accountId });
    expect(canon).toHaveLength(11);
  });

  it("rejects an out-of-range confidence", async () => {
    const { t, accountId } = await setup();
    const bad = { ...analysis, voice: { ...analysis.voice, confidence: 1.5 } };
    await expect(
      t
        .withIdentity({ subject: "c1" })
        .mutation(api.brandProfile.approveBrandProfile, { accountId, ...bad }),
    ).rejects.toThrow();
  });

  it("deduplicates theme chips repeated within one approval", async () => {
    const { t, accountId } = await setup();
    const dup = {
      ...analysis,
      themes: { ...analysis.themes, items: ["dogs", "dogs", "inverno"] },
    };
    await t
      .withIdentity({ subject: "c1" })
      .mutation(api.brandProfile.approveBrandProfile, { accountId, ...dup });
    const themes = await t.run((ctx) => ctx.db.query("themes").collect());
    expect(themes).toHaveLength(2); // dogs (once) + inverno
  });
});
