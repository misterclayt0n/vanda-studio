import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { consolidate } from "./consolidate";
import { makeBatchConsolidator, makeMemoryRecorder } from "./consolidate.testing";
import type { StoredSignal } from "./domain";
import { plan } from "./plan";
import { makePlannerStub, makeSuggestionsRecorder } from "./plan.testing";

const comment = (id: string, text: string, authorHandle: string): StoredSignal => ({
  id,
  source: "comments",
  text,
  authorHandle,
  mediaExternalId: "produto-1",
  mediaCaption: "Produto disponível para compra",
  syncKind: "reconciliation",
  observedAt: Date.now(),
});

describe("avaliação Klommerce", () => {
  it.effect(
    "transforma intenção de compra em uma proposta rastreável sem elevar reações vagas",
    () =>
      Effect.gen(function* () {
        const memory = makeMemoryRecorder({
          mode: "manual",
          brand: {
            locale: "pt-BR",
            accountName: "Klommerce",
            handle: "klommerce",
            brandKind: "negocio",
            canon: [
              { kind: "identity", text: "Loja de eletrônicos e acessórios" },
              { kind: "voice", text: "direta e acessível" },
            ],
            themes: [],
            referenceImageUrls: [],
          },
        });
        const inputs = [
          comment("s1", "já quero", "ana"),
          comment("s2", "já vou garantir o meu", "bia"),
          comment("s3", "receba meu dinheiro", "caio"),
          comment("s4", "top 🔥", "dani"),
          comment("s5", "😍😍", "eva"),
        ];
        const model = makeBatchConsolidator(() => ({
          groups: [
            {
              signalIds: ["s1", "s2", "s3"],
              kind: "audience",
              salience: 0.85,
              relation: "novel",
              beliefStatement:
                "Publicações que mostram produtos disponíveis despertam intenção de compra.",
              themeName: "Intenção de compra",
            },
          ],
          ignored: [],
        }));

        const consolidated = yield* consolidate("klommerce", inputs).pipe(
          Effect.provide(memory.layer),
          Effect.provide(model),
        );
        expect(consolidated.beliefs).toHaveLength(1);
        expect(consolidated.beliefs[0]!.supportingSignalIds).toEqual(["s1", "s2", "s3"]);
        expect(
          consolidated.consumedSignals.filter((signal) => signal.discardedReason),
        ).toHaveLength(2);

        const suggestions = makeSuggestionsRecorder();
        const belief = consolidated.beliefs[0]!;
        const planner = makePlannerStub(
          [
            {
              title: "Mostre o produto e como garantir o seu",
              format: "feed",
              themeName: "Intenção de compra",
              beliefKeys: [belief.key!],
              beliefStatements: [belief.statement],
              rationale: "Três clientes demonstraram intenção direta de compra.",
            },
          ],
          () => ({ verdict: "accept", reason: "específica e fundamentada", sensitive: false }),
        );
        yield* plan("klommerce").pipe(
          Effect.provide(memory.layer),
          Effect.provide(suggestions.layer),
          Effect.provide(planner),
        );

        expect(suggestions.saved).toHaveLength(1);
        expect(suggestions.saved[0]!.title).toContain("produto");
        expect(suggestions.saved[0]!.signalIds).toEqual(["s1", "s2", "s3"]);
      }),
  );
});
