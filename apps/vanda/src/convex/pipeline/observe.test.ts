import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ingestComments } from "./observe";
import { makeTestLayer } from "./testing";

describe("ingestComments", () => {
  it.effect("classifies each comment and persists a signal", () =>
    Effect.gen(function* () {
      const { layer, signals } = makeTestLayer();

      const result = yield* ingestComments("acct_1", [
        { externalId: "c1", text: "I love this place!" },
        { externalId: "c2", text: "What time do you open?" },
        { externalId: "c3", text: "the coffee was cold and the staff was rude" },
      ]).pipe(Effect.provide(layer));

      // forEach preserves input order regardless of concurrency.
      expect(result.map((s) => s.kind)).toEqual(["praise", "question", "complaint"]);
      expect(signals).toHaveLength(3);

      const persisted = Object.fromEntries(signals.map((s) => [s.externalId, s]));
      expect(persisted["c1"]!.accountExternalId).toBe("acct_1");
      expect(persisted["c1"]!.source).toBe("comments");
      expect(persisted["c1"]!.salience).toBe(0.6);
    }),
  );

  it.effect("is a no-op for an empty batch", () =>
    Effect.gen(function* () {
      const { layer, signals } = makeTestLayer();
      const result = yield* ingestComments("acct_1", []).pipe(Effect.provide(layer));
      expect(result).toHaveLength(0);
      expect(signals).toHaveLength(0);
    }),
  );
});
