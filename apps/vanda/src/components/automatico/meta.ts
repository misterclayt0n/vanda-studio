import { AtSign, Building2, Image as ImageIcon, MessageSquare, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NotableSignal } from "../../convex/board";

/** Source → how the Observando rail labels, icons, and tones each signal. */
export const SIGNAL_META: Record<
  NotableSignal["source"],
  { label: string; icon: LucideIcon; tone: string }
> = {
  comments: { label: "Comentário", icon: MessageSquare, tone: "text-text-2" },
  mentions: { label: "Menção", icon: AtSign, tone: "text-peri" },
  competitors: { label: "Concorrente", icon: Building2, tone: "text-peri" },
  trends: { label: "Tendência", icon: TrendingUp, tone: "text-green" },
  posts: { label: "Post", icon: ImageIcon, tone: "text-text-3" },
};

const FORMAT_LABEL: Record<string, string> = {
  feed: "Post",
  reel: "Reels",
  story: "Story",
  tweet: "Tweet",
  image: "Imagem",
};

/** The mono tag on a card — the media format, or "IDEIA" before a format is chosen. */
export function formatTag(format: string | null): string {
  return format ? (FORMAT_LABEL[format] ?? format).toUpperCase() : "IDEIA";
}

/** 0..1 confidence/progress → whole percent, the one place that rounding lives. */
export function confidencePct(value: number): number {
  return Math.round(value * 100);
}

/** "agora" · "há 5 min" · "há 2 h" · "ontem" · "há 3 d" — the Observando timestamps. */
export function relativeTime(ts: number): string {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} d`;
}

/** "ter · 12:00" — the Agendado date label. */
export function scheduleLabel(ts: number): string {
  const d = new Date(ts);
  const weekday = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${weekday} · ${time}`;
}
