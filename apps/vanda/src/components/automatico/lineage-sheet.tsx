import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Ban, Check, Layers, Pencil } from "lucide-react";
import { Button } from "@vanda-studio/ui/components/button";
import { Input } from "@vanda-studio/ui/components/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@vanda-studio/ui/components/sheet";
import { Spinner } from "@vanda-studio/ui/components/spinner";
import { cn } from "@vanda-studio/ui/lib/utils";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { LineageSignal } from "../../convex/board";
import { ConfidenceBar } from "./confidence-bar";
import { SIGNAL_META, confidencePct } from "./meta";

function SignalRow({ signal, onMarkNoise }: { signal: LineageSignal; onMarkNoise: () => void }) {
  const meta = SIGNAL_META[signal.source];
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5",
        signal.noise ? "border-border bg-inset opacity-60" : "border-border bg-surface",
      )}
    >
      <Icon className={cn("size-3.5 shrink-0", signal.noise ? "text-text-5" : meta.tone)} />
      <p
        className={cn(
          "min-w-0 flex-1 truncate text-[12px]",
          signal.noise ? "text-text-5 line-through" : "text-text-2",
        )}
      >
        {signal.authorHandle ? <span className="text-text-3">@{signal.authorHandle}: </span> : null}
        {signal.text}
      </p>
      {signal.noise ? (
        <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[9.5px] text-text-5">
          <Ban className="size-3" /> ruído
        </span>
      ) : (
        <Button
          variant="subtle"
          size="xs"
          className="shrink-0 hover:text-amber"
          onClick={onMarkNoise}
        >
          marcar como ruído
        </Button>
      )}
    </div>
  );
}

function LineageBody({ suggestionId }: { suggestionId: Id<"suggestions"> }) {
  const data = useQuery(api.board.lineage, { suggestionId });
  const markNoise = useMutation(api.board.markNoise);
  const correctBelief = useMutation(api.board.correctBelief);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (data === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="size-5 text-text-4" />
      </div>
    );
  }

  const belief = data.belief;
  const salient = data.salientSignals.filter((s) => !s.noise).length;
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <SheetHeader className="shrink-0 gap-0 border-b border-border px-5 py-4">
        <SheetTitle className="flex items-center gap-2 text-[13px] font-semibold">
          <span className="font-mono text-[10px] tracking-[0.1em] text-text-5 uppercase">
            Linhagem
          </span>
          <span className="text-text-5">·</span>
          <span className="truncate text-text-2">{data.suggestion.title}</span>
        </SheetTitle>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {belief ? (
          <section className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-[0.12em] text-peri uppercase">
                Crença
              </span>
              <span className="flex-1" />
              {editing ? null : (
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() => {
                    setDraft(belief.statement);
                    setEditing(true);
                  }}
                >
                  <Pencil /> Corrigir crença
                </Button>
              )}
            </div>

            {editing ? (
              <div className="mb-3 flex flex-col gap-2">
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  aria-label="Corrigir crença"
                  autoFocus
                />
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="brand"
                    size="sm"
                    disabled={!draft.trim() || draft.trim() === belief.statement}
                    onClick={async () => {
                      await correctBelief({ beliefId: belief.id, statement: draft.trim() });
                      setEditing(false);
                    }}
                  >
                    <Check /> Salvar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mb-3 text-[16px] font-medium leading-[1.35] text-pretty text-text">
                {belief.statement}
              </p>
            )}

            <div className="flex items-center gap-2.5">
              <ConfidenceBar value={belief.confidence} tone="peri" />
              <span className="font-mono text-[11px] text-peri">
                {confidencePct(belief.confidence)}%
              </span>
            </div>
            <p className="mt-2.5 text-[11.5px] text-text-4">
              sustentada por {salient} {salient === 1 ? "sinal saliente" : "sinais salientes"}
            </p>
          </section>
        ) : (
          <p className="text-[13px] text-text-4">Esta ideia ainda não tem uma crença ligada.</p>
        )}

        {data.salientSignals.length > 0 ? (
          <>
            <div className="mt-6 mb-2.5 font-mono text-[10px] tracking-[0.14em] text-text-5 uppercase">
              Sinais que a sustentam
            </div>
            <div className="flex flex-col gap-2">
              {data.salientSignals.map((signal) => (
                <SignalRow
                  key={signal.id}
                  signal={signal}
                  onMarkNoise={() => void markNoise({ signalId: signal.id })}
                />
              ))}
            </div>
          </>
        ) : null}

        {data.discardedCount > 0 ? (
          <p className="mt-4 flex items-center gap-2 text-[11px] text-text-5">
            <Layers className="size-3 shrink-0 text-text-6" />+{data.discardedCount} descartados por
            baixa saliência
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Intervir na linhagem — the product's magic made touchable. Opening a card shows
 * not just the idea but the reasoning: the belief, the signals sustaining it, and
 * the two ways to steer it (mark a signal as noise, correct the belief's wording).
 * The owner drives the reasoning, not just the output.
 */
export function LineageSheet({
  suggestionId,
  onClose,
}: {
  suggestionId: Id<"suggestions"> | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={suggestionId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 border-l border-border bg-app p-0 sm:max-w-[460px]"
      >
        {suggestionId ? <LineageBody suggestionId={suggestionId} /> : null}
      </SheetContent>
    </Sheet>
  );
}
