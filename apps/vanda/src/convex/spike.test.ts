// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import { signalsLayer } from "./pipeline/live";
import { ingestComments } from "./pipeline/observe";
import { keywordClassify, makeStubLanguageModel } from "./pipeline/testing";
import schema from "./schema";

// Loads every Convex module (including the Effect-backed `spike.ts`/`live.ts`)
// into the in-memory runtime, so a broken import/bundle of the v4 stack fails here.
const modules = import.meta.glob("./**/*.ts");

describe("signals CRUD + module load", () => {
  it("persists a signal via the internal mutation and reads it back by account", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internal.spike.insertSignal, {
      externalId: "c1",
      accountExternalId: "acct_1",
      source: "comments",
      kind: "praise",
      text: "I love this place!",
      salience: 0.6,
      observedAt: 1,
    });

    const rows = await t.query(internal.spike.listByAccount, { accountExternalId: "acct_1" });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.externalId).toBe("c1");
    expect(rows[0]!.kind).toBe("praise");

    const others = await t.query(internal.spike.listByAccount, { accountExternalId: "acct_2" });
    expect(others).toHaveLength(0);
  });
});

describe("Effect -> Convex seam", () => {
  it("runs the observe program through a real action ctx, persisting via the ctx-backed Signals layer", async () => {
    const t = convexTest(schema, modules);

    // Real action ctx (has runMutation) + stub model => the live persistence
    // seam runs end-to-end through Convex with no network.
    const result = await t.action(async (ctx) =>
      Effect.runPromise(
        ingestComments("acct_seam", [
          { externalId: "c1", text: "I absolutely love it!" },
          { externalId: "c2", text: "what time do you open?" },
        ]).pipe(
          Effect.provide(Layer.mergeAll(signalsLayer(ctx), makeStubLanguageModel(keywordClassify))),
        ),
      ),
    );

    expect(result.map((s) => s.kind)).toEqual(["praise", "question"]);

    const rows = await t.query(internal.spike.listByAccount, { accountExternalId: "acct_seam" });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.externalId)).toEqual(expect.arrayContaining(["c1", "c2"]));
  });
});
