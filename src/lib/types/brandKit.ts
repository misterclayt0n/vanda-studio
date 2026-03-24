/** Client-side mirror of Convex `projects.brandKit` (no Convex imports in routes). */
export type BrandKitState = {
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
};

export function emptyBrandKit(): BrandKitState {
    return {};
}

/** Merge AI suggestion into kit (skip empty values). */
export function mergeBrandSuggestion(
    target: BrandKitState,
    suggestion: Record<string, unknown>
): BrandKitState {
    const out: BrandKitState = { ...target };
    for (const [key, val] of Object.entries(suggestion)) {
        if (val === undefined || val === null) continue;
        if (typeof val === "string" && !val.trim()) continue;
        if (Array.isArray(val)) {
            const arr = val.filter((x) => typeof x === "string" && x.trim().length > 0) as string[];
            if (arr.length === 0) continue;
            (out as Record<string, unknown>)[key] = arr;
        } else if (typeof val === "string") {
            (out as Record<string, unknown>)[key] = val.trim();
        }
    }
    return out;
}

export function brandKitToDraftSummary(name: string, kit: BrandKitState, extra?: string): string {
    const lines = [`Nome do projeto: ${name}`];
    if (extra?.trim()) lines.push(extra.trim());
    const k = kit;
    if (k.elevatorPitch) lines.push(`Pitch: ${k.elevatorPitch}`);
    if (k.whatWeSell) lines.push(`Oferta: ${k.whatWeSell}`);
    if (k.whoWeServe) lines.push(`Público: ${k.whoWeServe}`);
    if (k.differentiators) lines.push(`Diferenciais: ${k.differentiators}`);
    if (k.toneAdjectives?.length) lines.push(`Tom: ${k.toneAdjectives.join(", ")}`);
    if (k.primaryColors?.length) lines.push(`Cores: ${k.primaryColors.join(", ")}`);
    if (k.typographyPrimary) lines.push(`Tipografia: ${k.typographyPrimary}`);
    return lines.join("\n");
}
