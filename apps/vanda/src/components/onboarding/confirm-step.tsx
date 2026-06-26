import { type ReactNode, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@vanda-studio/ui/components/button";
import { Input } from "@vanda-studio/ui/components/input";
import { cn } from "@vanda-studio/ui/lib/utils";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OnboardingHeader, StepIndicator } from "./onboarding-shell";
import type { BrandKindValue, CorpusStats, EditableAnalysis, GroupKey } from "./types";

// --- Confidence ------------------------------------------------------------

function confidenceTone(confidence: number): { label: string; className: string } {
  if (confidence >= 0.75) return { label: "Confiança alta", className: "text-green" };
  if (confidence >= 0.45) return { label: "Confiança média", className: "text-amber" };
  return { label: "Confiança baixa", className: "text-peri" };
}

function ConfidenceDot({ confidence }: { confidence: number }) {
  const { label, className } = confidenceTone(confidence);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em]",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

// --- Section scaffold ------------------------------------------------------

function Section({
  label,
  confidence,
  evidence,
  children,
}: {
  label: string;
  confidence: number;
  evidence?: string;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-border pt-6">
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-5">
          {label}
        </span>
        <ConfidenceDot confidence={confidence} />
      </div>
      <div className="mt-3">{children}</div>
      {evidence ? <p className="mt-2 font-mono text-[11px] text-text-5">{evidence}</p> : null}
    </div>
  );
}

// --- Editable chips --------------------------------------------------------

function ChipEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");

  function commit() {
    const next = value.trim();
    if (next.length > 0 && !items.includes(next)) onChange([...items, next]);
    setValue("");
    setAdding(false);
  }

  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-inset px-2.5 py-1 text-[13px] text-text-2"
        >
          {item}
          <button
            type="button"
            aria-label={`Remover ${item}`}
            className="rounded-sm text-text-5 transition-colors hover:text-text-3 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
            onClick={() => onChange(items.filter((i) => i !== item))}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          value={value}
          aria-label={`Adicionar a ${label}`}
          placeholder="adicionar…"
          onChange={(event) => setValue(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            } else if (event.key === "Escape") {
              setValue("");
              setAdding(false);
            }
          }}
          className="h-[28px] w-28 rounded-md border border-border-strong bg-transparent px-2 text-[13px] text-text transition-colors outline-none placeholder:text-text-5 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border-strong px-2.5 py-1 text-[13px] text-text-4 transition-colors hover:text-text-2 focus-visible:text-text-2 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <Plus className="size-3" /> adicionar
        </button>
      )}
    </div>
  );
}

// --- Tipo de marca + reference photos -------------------------------------

function KindOption({
  name,
  value,
  label,
  desc,
  selected,
  onSelect,
}: {
  name: string;
  value: BrandKindValue;
  label: string;
  desc: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "cursor-pointer rounded-xl border px-3.5 py-2.5 transition-colors duration-150 ease-[var(--ease-out)]",
        "border-border bg-surface hover:border-border-strong",
        "has-[:checked]:border-brand-accent has-[:checked]:bg-brand-accent/10",
        "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <span className="block text-[13.5px] font-medium text-text">{label}</span>
      <span className="mt-0.5 block text-[12.5px] text-text-4">{desc}</span>
    </label>
  );
}

function ReferencePhotos({ accountId }: { accountId: Id<"accounts"> }) {
  const photos = useQuery(api.brandProfile.listReferencePhotos, { accountId });
  const generateUploadUrl = useMutation(api.brandProfile.generateUploadUrl);
  const addReferencePhoto = useMutation(api.brandProfile.addReferencePhoto);
  const removeReferencePhoto = useMutation(api.brandProfile.removeReferencePhoto);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const url = await generateUploadUrl();
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error(`upload failed: ${res.status}`);
        const { storageId } = (await res.json()) as { storageId?: Id<"_storage"> };
        if (!storageId) throw new Error("upload returned no storageId");
        await addReferencePhoto({ accountId, storageId });
      }
    } catch {
      setError("Não consegui enviar a foto. Tente de novo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-inset p-4">
      <p className="text-[13px] text-text-2">Envie algumas fotos suas</p>
      <p className="mt-0.5 text-[12.5px] leading-[1.5] text-text-4">
        A Vanda usa pra criar posts com você — adicionar depois também funciona.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {photos?.map((photo) => (
          <div
            key={photo.id}
            className="group/photo relative size-16 overflow-hidden rounded-lg border border-border bg-surface"
          >
            {photo.url ? <img src={photo.url} alt="" className="size-full object-cover" /> : null}
            <button
              type="button"
              aria-label="Remover foto"
              onClick={() => void removeReferencePhoto({ imageId: photo.id })}
              className="absolute top-1 right-1 rounded-full bg-app/70 p-0.5 text-text-3 opacity-0 transition-opacity group-hover/photo:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={uploading}
          aria-label="Adicionar fotos de referência"
          onClick={() => inputRef.current?.click()}
          className="flex size-16 items-center justify-center rounded-lg border border-dashed border-border-strong text-text-4 transition-colors hover:text-text-2 focus-visible:text-text-2 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-50"
        >
          <Plus className="size-4" />
        </button>
      </div>
      {error ? <p className="mt-2 text-[12.5px] text-amber">{error}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => void onFiles(event.target.files)}
      />
    </div>
  );
}

// --- The step --------------------------------------------------------------

/**
 * Step 3 — the centerpiece. Vanda shows what she understood as a calm, editorial
 * summary (not a form): a hero paragraph, then facts grouped by certainty, the
 * brand type she proposes (with the reference-photo ask for personal brands), and
 * a forward-looking opportunities preview. Everything is editable in place; the
 * whole edited analysis is held client-side and committed at "Começar".
 */
export function ConfirmStep({
  accountId,
  analysis,
  stats,
  onContinue,
}: {
  accountId: Id<"accounts">;
  analysis: EditableAnalysis;
  stats: CorpusStats;
  onContinue: (edited: EditableAnalysis) => void;
}) {
  const [draft, setDraft] = useState<EditableAnalysis>(analysis);

  const setText = (key: "identity" | "summary", text: string) =>
    setDraft((d) => ({ ...d, [key]: { ...d[key], text } }));
  const setGroup = (key: GroupKey, items: string[]) =>
    setDraft((d) => ({ ...d, [key]: { ...d[key], items } }));
  const setKind = (value: BrandKindValue) =>
    setDraft((d) => ({ ...d, kind: { ...d.kind, value } }));

  return (
    <div className="flex min-h-svh flex-col bg-app text-text antialiased">
      <header className="mx-auto flex w-full max-w-[680px] items-center justify-between gap-4 px-6 pt-9">
        <OnboardingHeader />
        <StepIndicator current="confirmar" />
      </header>

      <div className="mx-auto w-full max-w-[680px] flex-1 overflow-y-auto px-6 pt-8 pb-10">
        <h1 className="text-[26px] font-semibold tracking-[-0.025em]">
          Confirme o que a Vanda entendeu.
        </h1>
        <p className="mt-2 text-[14.5px] text-text-3">
          Tudo abaixo é editável. A Vanda aprende com o que você corrige.
        </p>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.1em] text-text-5">
          Li {stats.posts} posts · {stats.comments} comentários · {stats.mentions} menções
        </p>

        {/* Hero summary — Vanda speaking */}
        <div className="mt-7">
          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-5">
              Em poucas palavras
            </span>
            <ConfidenceDot confidence={draft.summary.confidence} />
          </div>
          <textarea
            value={draft.summary.text}
            rows={3}
            aria-label="Resumo da Vanda"
            onChange={(event) => setText("summary", event.target.value)}
            className="mt-3 -mx-3 w-[calc(100%+1.5rem)] resize-none rounded-lg bg-transparent px-3 py-2 text-[17px] leading-[1.55] text-text-2 transition-colors duration-150 ease-[var(--ease-out)] outline-none focus-visible:bg-inset focus-visible:ring-3 focus-visible:ring-ring/30"
          />
          <p className="mt-1 font-mono text-[11px] text-text-5">
            Resumo da Vanda · clique para editar
          </p>
        </div>

        {/* O que sei — high confidence */}
        <Section
          label="Identidade"
          confidence={draft.identity.confidence}
          evidence={draft.identity.evidence}
        >
          <Input
            aria-label="Identidade"
            value={draft.identity.text}
            onChange={(event) => setText("identity", event.target.value)}
          />
        </Section>

        <Section
          label="Tom de voz"
          confidence={draft.voice.confidence}
          evidence={draft.voice.evidence}
        >
          <ChipEditor
            label="Tom de voz"
            items={draft.voice.items}
            onChange={(items) => setGroup("voice", items)}
          />
        </Section>

        {/* Tipo de marca — Vanda proposes, owner confirms */}
        <div className="border-t border-border pt-6">
          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-5">
              Tipo de marca
            </span>
            <ConfidenceDot confidence={draft.kind.confidence} />
          </div>
          <div
            className="mt-3 grid grid-cols-2 gap-2.5"
            role="radiogroup"
            aria-label="Tipo de marca"
          >
            <KindOption
              name="brand-kind"
              value="negocio"
              label="Negócio"
              desc="Um lugar ou produto"
              selected={draft.kind.value === "negocio"}
              onSelect={() => setKind("negocio")}
            />
            <KindOption
              name="brand-kind"
              value="pessoal"
              label="Pessoal"
              desc="Você é a marca"
              selected={draft.kind.value === "pessoal"}
              onSelect={() => setKind("pessoal")}
            />
          </div>
          {draft.kind.value === "pessoal" ? <ReferencePhotos accountId={accountId} /> : null}
        </div>

        {/* O que imagino — lower confidence, more tentative */}
        <Section
          label="Temas recorrentes"
          confidence={draft.themes.confidence}
          evidence={draft.themes.evidence}
        >
          <ChipEditor
            label="Temas recorrentes"
            items={draft.themes.items}
            onChange={(items) => setGroup("themes", items)}
          />
        </Section>

        <Section
          label="Personagens"
          confidence={draft.characters.confidence}
          evidence={draft.characters.evidence}
        >
          <ChipEditor
            label="Personagens"
            items={draft.characters.items}
            onChange={(items) => setGroup("characters", items)}
          />
        </Section>

        <Section
          label="Restrições"
          confidence={draft.restrictions.confidence}
          evidence={draft.restrictions.evidence}
        >
          <ChipEditor
            label="Restrições"
            items={draft.restrictions.items}
            onChange={(items) => setGroup("restrictions", items)}
          />
        </Section>

        {/* Opportunities — a forward-looking preview, not a confirmed fact */}
        <div className="mt-6 border-t border-border pt-6">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-brand-accent" />
            <span className="text-[14px] font-medium text-text">E é por aqui que eu começaria</span>
          </div>
          <p className="mt-1 text-[13px] leading-[1.5] text-text-4">
            Não é parte do seu perfil — são os primeiros movimentos que a Vanda planeja.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {draft.opportunities.items.map((item) => (
              <span
                key={item}
                className="rounded-md border border-border bg-inset px-2.5 py-1 text-[13px] text-text-2"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-app">
        <div className="mx-auto flex w-full max-w-[680px] items-center gap-4 px-6 py-4">
          <Button variant="brand" size="lg" onClick={() => onContinue(draft)}>
            Continuar
            <ArrowRight />
          </Button>
          <span className="text-[13px] text-text-4">Você pode ajustar tudo depois, no Perfil.</span>
        </div>
      </div>
    </div>
  );
}
