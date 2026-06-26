import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@vanda-studio/ui/components/button";
import { cn } from "@vanda-studio/ui/lib/utils";
import { OnboardingSplit } from "./onboarding-shell";

export type Mode = "auto" | "needs_approval" | "manual";

const MODES: { value: Mode; label: string; desc: string; recommended?: boolean }[] = [
  { value: "auto", label: "Automático", desc: "A Vanda cria e agenda sozinha. Você acompanha." },
  {
    value: "needs_approval",
    label: "Aprovação",
    desc: "A Vanda propõe; você aprova antes de publicar.",
    recommended: true,
  },
  { value: "manual", label: "Manual", desc: "Você cria. A Vanda ajuda quando você pedir." },
];

/**
 * Step 4 — the one decision Vanda can't make for you. Its "Começar" is the final
 * commit of the whole onboarding (brand + mode written atomically by the parent).
 */
export function ModeStep({ busy, onFinish }: { busy: boolean; onFinish: (mode: Mode) => void }) {
  const [mode, setMode] = useState<Mode>("needs_approval");

  return (
    <OnboardingSplit
      current="modo"
      aperture={{ caption: "Operar por exceção", sub: "Ela só te chama quando precisa" }}
    >
      <h1 className="text-[30px] font-semibold leading-[1.12] tracking-[-0.03em]">
        Quanta liberdade a Vanda tem?
      </h1>
      <p className="mt-3 text-[14.5px] text-text-3">Você pode mudar isso depois.</p>

      <div className="mt-7 flex flex-col gap-2.5" role="radiogroup" aria-label="Modo de autonomia">
        {MODES.map((option) => {
          const selected = option.value === mode;
          return (
            <label
              key={option.value}
              className={cn(
                "cursor-pointer rounded-xl border px-4 py-3 transition-colors duration-150 ease-[var(--ease-out)]",
                "border-border bg-surface hover:border-border-strong",
                "has-[:checked]:border-brand-accent has-[:checked]:bg-brand-accent/10",
                "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40",
              )}
            >
              <input
                type="radio"
                name="onboarding-mode"
                value={option.value}
                checked={selected}
                onChange={() => setMode(option.value)}
                className="sr-only"
              />
              <span className="flex items-center gap-2">
                <span className="text-[14px] font-medium text-text">{option.label}</span>
                {option.recommended ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-brand-accent">
                    Recomendado
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-[13px] leading-[1.5] text-text-3">
                {option.desc}
              </span>
            </label>
          );
        })}
      </div>

      <Button
        variant="brand"
        size="xl"
        className="mt-7 w-full"
        disabled={busy}
        onClick={() => onFinish(mode)}
      >
        {busy ? "Começando…" : "Começar"}
        {busy ? null : <ArrowRight />}
      </Button>
    </OnboardingSplit>
  );
}
