import { Calendar } from "lucide-react";
import type { ScheduledCard as ScheduledCardData } from "../../convex/board";
import { confidencePct, formatTag, scheduleLabel } from "./meta";

/** An Agendado card — a post pinned to a datetime, shown with its belief provenance. */
export function AgendadoCard({ card }: { card: ScheduledCardData }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.06em] text-text-5">
          {formatTag(card.format)}
        </span>
        {card.status === "publishing" ? (
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-brand-soft">
            publicando
          </span>
        ) : null}
      </div>
      <p className="mb-2.5 line-clamp-2 text-[13.5px] font-medium leading-[1.4] text-text">
        {card.title}
      </p>
      {card.belief ? (
        <span className="mb-2.5 inline-flex max-w-full items-center gap-1.5 rounded-sm border border-peri/20 bg-peri/8 px-2 py-1 text-[10.5px] text-peri">
          <span className="truncate">
            crença: {card.belief.statement} · {confidencePct(card.belief.confidence)}%
          </span>
        </span>
      ) : null}
      <div className="flex items-center gap-1.5 text-[11.5px] text-text-4">
        <Calendar className="size-3.5 text-text-5" />
        {scheduleLabel(card.scheduledFor)}
      </div>
    </div>
  );
}
