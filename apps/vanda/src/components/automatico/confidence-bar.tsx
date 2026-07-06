import { cn } from "@vanda-studio/ui/lib/utils";

/**
 * A thin confidence/progress bar. `peri` grounds beliefs (what Vanda knows);
 * `brand` tracks a create in flight (Vanda fazendo). Width animates on change so
 * a recomputed confidence visibly settles.
 */
export function ConfidenceBar({
  value,
  tone = "peri",
}: {
  value: number;
  tone?: "peri" | "brand";
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out)]",
          tone === "brand" ? "bg-brand-accent" : "bg-peri",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
