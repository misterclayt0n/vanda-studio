// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("pipeline intelligence boundaries", () => {
  it("builds account-scoped semantic sources from canon, memory, content, and feedback", async () => {
    const t = convexTest(schema, modules);
    const accountId = await t.run(async (ctx) => {
      const now = Date.now();
      const id = await ctx.db.insert("accounts", { mode: "auto", createdAt: now, updatedAt: now });
      await ctx.db.insert("brandCanon", {
        accountId: id,
        kind: "identity",
        text: "Loja brasileira de eletrônicos",
        confirmedByOwner: true,
        createdAt: now,
      });
      await ctx.db.insert("beliefs", {
        accountId: id,
        statement: "Clientes perguntam pelo preço antes de comprar",
        kind: "audience",
        confidence: 0.8,
        supportingSignalIds: ["a", "b", "c"],
        firstSeenAt: now,
        confidenceAsOf: now,
        status: "active",
      });
      await ctx.db.insert("posts", {
        accountId: id,
        type: "feed",
        imageIds: [],
        caption: "Conheça nossa seleção",
        platform: "instagram",
        status: "ready",
        createdAt: now,
      });
      await ctx.db.insert("suggestions", {
        accountId: id,
        title: "Ideia genérica",
        rationale: "Sem relação com a marca",
        themeName: "Geral",
        beliefStatements: [],
        signalIds: [],
        status: "rejected",
        requiresApproval: false,
        rejectionReason: "Não é específica",
        createdAt: now,
      });
      return id;
    });

    const sources = await t.query(internal.knowledge.sources, { accountId });

    expect(new Set(sources.map((source) => source.kind))).toEqual(
      new Set(["canon", "belief", "post", "feedback"]),
    );
    expect(sources.every((source) => source.text.length > 0)).toBe(true);
  });

  it("resets derived intelligence without deleting raw signals or owner noise decisions", async () => {
    const t = convexTest(schema, modules);
    const { accountId, liveSignal, noiseSignal } = await t.run(async (ctx) => {
      const now = Date.now();
      const accountId = await ctx.db.insert("accounts", {
        mode: "auto",
        createdAt: now,
        updatedAt: now,
      });
      const liveSignal = await ctx.db.insert("signals", {
        accountId,
        source: "comments",
        externalId: "live",
        text: "quanto custa?",
        observedAt: now,
        consolidatedAt: now,
        actionable: true,
        salience: 0.9,
      });
      const noiseSignal = await ctx.db.insert("signals", {
        accountId,
        source: "comments",
        externalId: "noise",
        text: "top",
        observedAt: now,
        consolidatedAt: now,
        actionable: false,
        noise: true,
      });
      await ctx.db.insert("beliefs", {
        accountId,
        statement: "Há intenção de compra",
        kind: "audience",
        confidence: 0.8,
        supportingSignalIds: [liveSignal],
        firstSeenAt: now,
        confidenceAsOf: now,
        status: "active",
      });
      await ctx.db.insert("knowledgeChunks", {
        accountId,
        kind: "belief",
        sourceId: "belief:test",
        text: "Há intenção de compra",
        embedding: Array.from({ length: 1536 }, () => 0),
        active: true,
        createdAt: now,
      });
      return { accountId, liveSignal, noiseSignal };
    });

    await t.mutation(internal.pipelineAdmin.resetDerived, { accountId });

    const state = await t.run(async (ctx) => ({
      beliefs: await ctx.db.query("beliefs").collect(),
      knowledge: await ctx.db.query("knowledgeChunks").collect(),
      live: await ctx.db.get(liveSignal),
      noise: await ctx.db.get(noiseSignal),
    }));
    expect(state.beliefs).toHaveLength(0);
    expect(state.knowledge).toHaveLength(0);
    expect(state.live?.consolidatedAt).toBeUndefined();
    expect(state.live?.actionable).toBeUndefined();
    expect(state.noise?.noise).toBe(true);
    expect(state.noise?.consolidatedAt).toBeDefined();
  });

  it("records model, prompt version, inputs, outcome, and completion", async () => {
    const t = convexTest(schema, modules);
    const accountId = await t.run((ctx) =>
      ctx.db.insert("accounts", { mode: "auto", createdAt: 1, updatedAt: 1 }),
    );
    const runId = await t.mutation(internal.modelTelemetry.start, {
      accountId,
      stage: "consolidate",
      model: "openai/gpt-5-nano",
      promptVersion: "consolidate/batch-brand-v1",
      inputIds: ["signal-1"],
    });
    await t.mutation(internal.modelTelemetry.finish, {
      runId,
      status: "succeeded",
      outputSummary: "1 crença",
    });

    const run = await t.run((ctx) => ctx.db.get(runId));
    expect(run).toMatchObject({
      stage: "consolidate",
      model: "openai/gpt-5-nano",
      promptVersion: "consolidate/batch-brand-v1",
      inputIds: ["signal-1"],
      status: "succeeded",
      outputSummary: "1 crença",
    });
    expect(run?.completedAt).toBeTypeOf("number");
  });
});
