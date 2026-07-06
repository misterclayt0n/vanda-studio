import { cn } from "@vanda-studio/ui/lib/utils";
import { accountModes } from "../../convex/pipeline/constants";

/** The autonomy mode — the single source of truth is `accountModes`. */
export type Mode = (typeof accountModes)[number];

const MODES: { value: Mode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "needs_approval", label: "Aprovação" },
  { value: "manual", label: "Manual" },
];

/** The autonomy segmented control — how much freedom Vanda has, changeable anytime. */
export function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-inset p-[3px]">
      {MODES.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={mode === option.value}
          className={cn(
            "inline-flex h-[26px] items-center rounded-sm px-2.5 text-xs font-medium transition-colors duration-150 ease-[var(--ease-out)]",
            mode === option.value ? "bg-border-strong text-text" : "text-text-4 hover:text-text-2",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
