/**
 * Builds the persisted brand brief string used in AI system prompts.
 * Combines structured brandKit with legacy flat fields for backward compatibility.
 */

export type BrandKitSlice = {
    elevatorPitch?: string;
    whatWeSell?: string;
    whoWeServe?: string;
    differentiators?: string;
    competitorsNotes?: string;
    toneAdjectives?: string[];
    writingRules?: string;
    languages?: string[];
    emojiPolicy?: string;
    ctaStyle?: string;
    primaryColors?: string[];
    secondaryColors?: string[];
    typographyPrimary?: string;
    typographySecondary?: string;
    imageryGuidelines?: string;
    ingestSummarySnippet?: string;
};

export type BrandCompileInput = {
    name: string;
    brandKit?: BrandKitSlice;
    accountDescription?: string;
    brandTraits?: string[];
    additionalContext?: string;
};

function pushSection(lines: string[], title: string, body: string | undefined) {
    const t = body?.trim();
    if (!t) return;
    lines.push(`### ${title}`);
    lines.push(t);
    lines.push("");
}

function pushList(lines: string[], title: string, items: string[] | undefined) {
    if (!items || items.length === 0) return;
    lines.push(`### ${title}`);
    lines.push(items.join(", "));
    lines.push("");
}

export function compileBrandContextMarkdown(input: BrandCompileInput): string {
    const lines: string[] = ["## Brief da marca", `**Projeto:** ${input.name}`, ""];

    const kit = input.brandKit;
    if (kit) {
        pushSection(lines, "Pitch", kit.elevatorPitch);
        pushSection(lines, "O que vende / oferece", kit.whatWeSell);
        pushSection(lines, "Público-alvo", kit.whoWeServe);
        pushSection(lines, "Diferenciais", kit.differentiators);
        pushSection(lines, "Concorrência / notas", kit.competitorsNotes);
        pushList(lines, "Tom (adjetivos)", kit.toneAdjectives);
        pushSection(lines, "Regras de escrita", kit.writingRules);
        pushList(lines, "Idiomas", kit.languages);
        pushSection(lines, "Política de emoji", kit.emojiPolicy);
        pushSection(lines, "Estilo de CTA", kit.ctaStyle);
        pushList(lines, "Cores primárias", kit.primaryColors);
        pushList(lines, "Cores secundárias", kit.secondaryColors);
        pushSection(lines, "Tipografia principal", kit.typographyPrimary);
        pushSection(lines, "Tipografia secundária", kit.typographySecondary);
        pushSection(lines, "Diretrizes de imagem", kit.imageryGuidelines);
        pushSection(lines, "Resumo da última ingestão (site)", kit.ingestSummarySnippet);
    }

    // Legacy fields (still used across the app until fully migrated)
    pushSection(lines, "Descrição da conta (legado)", input.accountDescription);
    pushList(lines, "Características da marca (legado)", input.brandTraits);
    pushSection(lines, "Contexto adicional (legado)", input.additionalContext);

    const out = lines.join("\n").trim();
    return out.length > 0 ? out : "";
}

export function mergeBrandKit(
    existing: BrandKitSlice | undefined | null,
    patch: BrandKitSlice | undefined | null
): BrandKitSlice | undefined {
    if (!patch && !existing) return undefined;
    if (!patch) return existing ?? undefined;
    if (!existing) return { ...patch };
    return { ...existing, ...patch };
}

function isEmptyKitValue(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value === "string") return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    return false;
}

/** Only sets keys in `patch` when the existing value is empty (for Instagram analysis merge). */
export function mergeBrandKitFillEmpty(
    existing: BrandKitSlice | undefined | null,
    patch: BrandKitSlice | undefined | null
): BrandKitSlice | undefined {
    if (!patch && !existing) return undefined;
    if (!patch) return existing ?? undefined;
    const base: BrandKitSlice = { ...(existing ?? {}) };
    for (const key of Object.keys(patch) as (keyof BrandKitSlice)[]) {
        const next = patch[key];
        if (next === undefined) continue;
        if (!isEmptyKitValue(base[key])) continue;
        (base as Record<string, unknown>)[key as string] = next;
    }
    return Object.keys(base).length > 0 ? base : undefined;
}
