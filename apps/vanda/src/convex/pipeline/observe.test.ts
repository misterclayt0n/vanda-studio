import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { observe } from "./observe";
import { fakeAdapter, failingAdapter, makeSignalsRecorder } from "./observe.testing";

describe("observe", () => {
  it.effect("persists new signals from every adapter, scoped to the account", () =>
    Effect.gen(function* () {
      const recorder = makeSignalsRecorder();
      const persisted = yield* observe("acct_1", [
        fakeAdapter("comments", [
          { externalId: "c1", text: "love it", observedAt: 1 },
          { externalId: "c2", text: "what hours?", observedAt: 2 },
        ]),
        fakeAdapter("mentions", [{ externalId: "m1", text: "@cafe great", observedAt: 3 }]),
      ]).pipe(Effect.provide(recorder.layer));

      // forEach preserves order: [comments..., mentions...]
      expect(persisted.map((s) => s.externalId)).toEqual(["c1", "c2", "m1"]);
      expect(recorder.stored).toHaveLength(3);
      expect(recorder.stored.every((s) => s.accountId === "acct_1")).toBe(true);
    }),
  );

  it.effect("dedups against already-stored signals of the same source", () =>
    Effect.gen(function* () {
      const recorder = makeSignalsRecorder({
        seed: [
          { accountId: "acct_1", source: "comments", externalId: "c1", text: "old", observedAt: 1 },
        ],
      });
      const persisted = yield* observe("acct_1", [
        fakeAdapter("comments", [
          { externalId: "c1", text: "dup", observedAt: 5 },
          { externalId: "c2", text: "new", observedAt: 6 },
        ]),
      ]).pipe(Effect.provide(recorder.layer));

      expect(persisted.map((s) => s.externalId)).toEqual(["c2"]);
      expect(recorder.stored).toHaveLength(2); // seed + the one new
    }),
  );

  it.effect("treats the same externalId under a different source as new", () =>
    Effect.gen(function* () {
      const recorder = makeSignalsRecorder({
        seed: [
          { accountId: "acct_1", source: "comments", externalId: "x1", text: "c", observedAt: 1 },
        ],
      });
      const persisted = yield* observe("acct_1", [
        fakeAdapter("mentions", [{ externalId: "x1", text: "m", observedAt: 2 }]),
      ]).pipe(Effect.provide(recorder.layer));

      expect(persisted).toHaveLength(1);
      expect(persisted[0]!.source).toBe("mentions");
      expect(recorder.stored).toHaveLength(2);
    }),
  );

  it.effect("is resilient: a failing source does not block the others", () =>
    Effect.gen(function* () {
      const recorder = makeSignalsRecorder();
      const persisted = yield* observe("acct_1", [
        fakeAdapter("comments", [{ externalId: "c1", text: "ok", observedAt: 1 }]),
        failingAdapter("mentions"),
      ]).pipe(Effect.provide(recorder.layer));

      expect(persisted.map((s) => s.externalId)).toEqual(["c1"]);
      expect(recorder.stored).toHaveLength(1);
    }),
  );

  it.effect("propagates a store failure rather than swallowing it", () =>
    Effect.gen(function* () {
      const recorder = makeSignalsRecorder({ failOnInsert: true });
      const exit = yield* observe("acct_1", [
        fakeAdapter("comments", [{ externalId: "c1", text: "x", observedAt: 1 }]),
      ]).pipe(Effect.provide(recorder.layer), Effect.exit);
      expect(exit._tag).toBe("Failure");
    }),
  );

  it.effect("is a no-op with no adapters", () =>
    Effect.gen(function* () {
      const recorder = makeSignalsRecorder();
      const persisted = yield* observe("acct_1", []).pipe(Effect.provide(recorder.layer));
      expect(persisted).toHaveLength(0);
      expect(recorder.stored).toHaveLength(0);
    }),
  );
});
