<script lang="ts">
    import { cn, loadGoogleFont, fontFamily } from "$lib/utils";
    import type { BrandKitState } from "$lib/types/brandKit";
    import { Pencil, Sparkles, Check, X, Plus, Trash2, ImagePlus } from "lucide-svelte";
    import { Input, Textarea, Button } from "$lib/components/ui";

    type SectionKey = "pitch" | "colors" | "typography" | "strategy" | "voice" | "details";

    interface Props {
        brandKit: BrandKitState;
        brandName?: string;
        logoUrl?: string | null;
        audienceLabel?: string;
        vibeLabel?: string | null;
        onupdate?: (kit: BrandKitState) => void;
        /** @deprecated Use onupdate instead */
        onedit?: (section: "pitch" | "audience" | "vibe" | "tone" | "refs") => void;
        compact?: boolean;
        loading?: boolean;
        class?: string;
    }

    let {
        brandKit,
        brandName = "",
        logoUrl = null,
        audienceLabel,
        vibeLabel,
        onupdate,
        onedit,
        compact = false,
        loading = false,
        class: className,
    }: Props = $props();

    // ── Inline editing state ───────────────────────────────────────────
    let editingSection = $state<SectionKey | null>(null);
    let editDraft = $state<Record<string, unknown>>({});

    function startEdit(section: SectionKey) {
        editingSection = section;
        switch (section) {
            case "pitch":
                editDraft = { elevatorPitch: brandKit.elevatorPitch ?? "" };
                break;
            case "colors":
                editDraft = {
                    primaryColors: [...(brandKit.primaryColors ?? [])],
                    secondaryColors: [...(brandKit.secondaryColors ?? [])],
                };
                break;
            case "typography":
                editDraft = {
                    typographyPrimary: brandKit.typographyPrimary ?? "",
                    typographySecondary: brandKit.typographySecondary ?? "",
                };
                break;
            case "strategy":
                editDraft = {
                    whatWeSell: brandKit.whatWeSell ?? "",
                    whoWeServe: brandKit.whoWeServe ?? "",
                    differentiators: brandKit.differentiators ?? "",
                    competitorsNotes: brandKit.competitorsNotes ?? "",
                };
                break;
            case "voice":
                editDraft = {
                    toneAdjectives: [...(brandKit.toneAdjectives ?? [])],
                    writingRules: brandKit.writingRules ?? "",
                };
                break;
            case "details":
                editDraft = {
                    emojiPolicy: brandKit.emojiPolicy ?? "",
                    ctaStyle: brandKit.ctaStyle ?? "",
                    imageryGuidelines: brandKit.imageryGuidelines ?? "",
                };
                break;
        }
    }

    function saveEdit() {
        if (!editingSection || !onupdate) { editingSection = null; return; }
        const updated = { ...brandKit, ...editDraft };
        onupdate(updated);
        editingSection = null;
        editDraft = {};
    }

    function cancelEdit() {
        editingSection = null;
        editDraft = {};
    }

    // ── Draft helpers for array manipulation ───────────────────────────
    function addColorToPrimary() {
        const arr = editDraft.primaryColors as string[];
        editDraft = { ...editDraft, primaryColors: [...arr, "#888888"] };
    }
    function addColorToSecondary() {
        const arr = editDraft.secondaryColors as string[];
        editDraft = { ...editDraft, secondaryColors: [...arr, "#888888"] };
    }
    function removeColor(which: "primaryColors" | "secondaryColors", idx: number) {
        const arr = [...(editDraft[which] as string[])];
        arr.splice(idx, 1);
        editDraft = { ...editDraft, [which]: arr };
    }
    function updateColor(which: "primaryColors" | "secondaryColors", idx: number, val: string) {
        const arr = [...(editDraft[which] as string[])];
        arr[idx] = val;
        editDraft = { ...editDraft, [which]: arr };
    }
    function addToneAdjective() {
        const arr = editDraft.toneAdjectives as string[];
        editDraft = { ...editDraft, toneAdjectives: [...arr, ""] };
    }
    function removeToneAdjective(idx: number) {
        const arr = [...(editDraft.toneAdjectives as string[])];
        arr.splice(idx, 1);
        editDraft = { ...editDraft, toneAdjectives: arr };
    }
    function updateToneAdjective(idx: number, val: string) {
        const arr = [...(editDraft.toneAdjectives as string[])];
        arr[idx] = val;
        editDraft = { ...editDraft, toneAdjectives: arr };
    }

    // ── Derived ────────────────────────────────────────────────────────
    let allColors = $derived([
        ...(brandKit.primaryColors ?? []),
        ...(brandKit.secondaryColors ?? []),
    ]);

    let primaryColor = $derived(brandKit.primaryColors?.[0] ?? "#888");

    $effect(() => {
        loadGoogleFont(brandKit.typographyPrimary);
        loadGoogleFont(brandKit.typographySecondary);
    });
</script>

{#snippet sectionHeader(label: string, section: SectionKey)}
    <div class="flex items-center justify-between gap-2 mb-3">
        <span class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/50">{label}</span>
        {#if !loading && onupdate}
            {#if editingSection === section}
                <div class="flex items-center gap-1">
                    <button type="button" class="p-1 text-muted-foreground/50 hover:text-foreground transition-colors" onclick={cancelEdit}>
                        <X class="h-3 w-3" />
                    </button>
                    <button type="button" class="p-1 text-primary hover:text-primary/80 transition-colors" onclick={saveEdit}>
                        <Check class="h-3 w-3" />
                    </button>
                </div>
            {:else}
                <button
                    type="button"
                    class="p-1 text-muted-foreground/30 transition-colors hover:text-foreground"
                    onclick={() => startEdit(section)}
                >
                    <Pencil class="h-3 w-3" />
                </button>
            {/if}
        {/if}
    </div>
{/snippet}

<!-- ═══ LOADING STATE ═══ -->
{#if loading}
    <div class={cn("border border-border bg-card overflow-hidden", className)}>
        <div class="flex flex-col items-center justify-center gap-5 py-20 px-6">
            <div class="relative">
                <div class="h-10 w-10 text-primary animate-pulse">
                    <Sparkles class="h-10 w-10" />
                </div>
                <div class="absolute inset-0 h-10 w-10 text-primary/30 animate-ping">
                    <Sparkles class="h-10 w-10" />
                </div>
            </div>
            <div class="text-center space-y-1.5">
                <p class="text-sm font-medium text-foreground">A Vanda está montando sua identidade</p>
                <p class="text-xs text-muted-foreground">Cores, tipografia, tom de voz, estratégia...</p>
            </div>
            <div class="w-full max-w-md space-y-3 mt-4">
                <div class="flex gap-1.5">
                    {#each Array(7) as _, i}
                        <div
                            class="h-10 flex-1 bg-muted-foreground/5 animate-pulse"
                            style="animation-delay: {i * 100}ms"
                        ></div>
                    {/each}
                </div>
                <div class="grid grid-cols-2 gap-3 mt-4">
                    <div class="h-20 bg-muted-foreground/5 animate-pulse" style="animation-delay: 700ms"></div>
                    <div class="h-20 bg-muted-foreground/5 animate-pulse" style="animation-delay: 820ms"></div>
                </div>
                <div class="h-3 w-3/4 bg-muted-foreground/5 animate-pulse" style="animation-delay: 900ms"></div>
                <div class="h-3 w-1/2 bg-muted-foreground/5 animate-pulse" style="animation-delay: 1000ms"></div>
            </div>
        </div>
    </div>

<!-- ═══ COMPACT MODE (settings page) ═══ -->
{:else if compact}
    <div class={cn("border border-border bg-card p-4", className)}>
        {#if brandKit.elevatorPitch}
            <p class="text-sm leading-relaxed mb-3">{brandKit.elevatorPitch}</p>
        {/if}
        {#if allColors.length > 0}
            <div class="flex gap-1.5 mb-3">
                {#each allColors as color (color)}
                    <div class="h-6 w-6 rounded-sm" style="background-color: {color}"></div>
                {/each}
            </div>
        {/if}
        {#if brandKit.toneAdjectives?.length}
            <div class="flex flex-wrap gap-1">
                {#each brandKit.toneAdjectives as tone (tone)}
                    <span class="border border-border px-2 py-0.5 text-xs">{tone}</span>
                {/each}
            </div>
        {/if}
    </div>

<!-- ═══ FULL BRAND BOARD — WIDE LAYOUT ═══ -->
{:else}
    <div class={cn("overflow-hidden", className)}>

        <!-- ── Row 1: Hero — full width ── -->
        <div class="board-section border border-border bg-card relative px-8 pt-10 pb-8" style="border-bottom: 3px solid {primaryColor}; --reveal-delay: 0ms">
            {#if editingSection === "pitch"}
                {@render sectionHeader("Nome & Pitch", "pitch")}
                <Textarea
                    class="min-h-[80px] resize-none bg-background text-base"
                    value={editDraft.elevatorPitch as string}
                    oninput={(e) => { editDraft = { ...editDraft, elevatorPitch: e.currentTarget.value }; }}
                    placeholder="Descreva sua marca..."
                />
            {:else}
                {@render sectionHeader("Nome & Pitch", "pitch")}
                <div class="flex items-start gap-6">
                    <!-- Logo placeholder -->
                    <div class="shrink-0">
                        {#if logoUrl}
                            <div class="h-20 w-20 overflow-hidden border border-border">
                                <img src={logoUrl} alt="Logo" class="h-full w-full object-contain" />
                            </div>
                        {:else}
                            <div class="flex h-20 w-20 flex-col items-center justify-center gap-1 border border-dashed border-border/50 text-muted-foreground/25 transition-colors hover:border-muted-foreground/40 hover:text-muted-foreground/40">
                                <ImagePlus class="h-5 w-5" />
                                <span class="text-[8px] uppercase tracking-wider">Logo</span>
                            </div>
                        {/if}
                    </div>

                    <div class="min-w-0 flex-1">
                        {#if brandName}
                            <h2
                                class="text-4xl font-bold tracking-tight leading-tight"
                                style="font-family: {fontFamily(brandKit.typographyPrimary)}"
                            >
                                {brandName}
                            </h2>
                        {/if}
                        {#if brandKit.elevatorPitch}
                            <p
                                class="mt-3 text-base leading-relaxed text-muted-foreground max-w-2xl"
                                style="font-family: {fontFamily(brandKit.typographySecondary)}"
                            >
                                {brandKit.elevatorPitch}
                            </p>
                        {/if}
                    </div>
                </div>
            {/if}
        </div>

        <!-- ── Row 2: Visual Identity — 2 columns ── -->
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-0">
            <!-- Color Palette — 3/5 width -->
            {#if allColors.length > 0 || editingSection === "colors"}
                <div class="lg:col-span-3 border border-t-0 border-border bg-card px-8 py-6 board-section" style="--reveal-delay: 80ms">
                    {#if editingSection === "colors"}
                        {@render sectionHeader("Paleta de cores", "colors")}
                        <div class="space-y-4">
                            <div>
                                <span class="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-2 block">Primárias</span>
                                <div class="flex flex-wrap gap-2">
                                    {#each (editDraft.primaryColors as string[]) as color, i}
                                        <div class="flex items-center gap-1">
                                            <input
                                                type="color"
                                                value={color}
                                                oninput={(e) => updateColor("primaryColors", i, e.currentTarget.value)}
                                                class="h-8 w-8 cursor-pointer border-0 p-0"
                                            />
                                            <input
                                                type="text"
                                                value={color}
                                                oninput={(e) => updateColor("primaryColors", i, e.currentTarget.value)}
                                                class="w-20 bg-background border border-border px-2 py-1 font-mono text-xs"
                                            />
                                            <button type="button" class="p-1 text-muted-foreground/40 hover:text-destructive" onclick={() => removeColor("primaryColors", i)}>
                                                <Trash2 class="h-3 w-3" />
                                            </button>
                                        </div>
                                    {/each}
                                    <button type="button" class="flex h-8 items-center gap-1 border border-dashed border-border px-3 text-xs text-muted-foreground hover:border-foreground hover:text-foreground transition-colors" onclick={addColorToPrimary}>
                                        <Plus class="h-3 w-3" /> Adicionar
                                    </button>
                                </div>
                            </div>
                            <div>
                                <span class="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-2 block">Secundárias</span>
                                <div class="flex flex-wrap gap-2">
                                    {#each (editDraft.secondaryColors as string[]) as color, i}
                                        <div class="flex items-center gap-1">
                                            <input
                                                type="color"
                                                value={color}
                                                oninput={(e) => updateColor("secondaryColors", i, e.currentTarget.value)}
                                                class="h-8 w-8 cursor-pointer border-0 p-0"
                                            />
                                            <input
                                                type="text"
                                                value={color}
                                                oninput={(e) => updateColor("secondaryColors", i, e.currentTarget.value)}
                                                class="w-20 bg-background border border-border px-2 py-1 font-mono text-xs"
                                            />
                                            <button type="button" class="p-1 text-muted-foreground/40 hover:text-destructive" onclick={() => removeColor("secondaryColors", i)}>
                                                <Trash2 class="h-3 w-3" />
                                            </button>
                                        </div>
                                    {/each}
                                    <button type="button" class="flex h-8 items-center gap-1 border border-dashed border-border px-3 text-xs text-muted-foreground hover:border-foreground hover:text-foreground transition-colors" onclick={addColorToSecondary}>
                                        <Plus class="h-3 w-3" /> Adicionar
                                    </button>
                                </div>
                            </div>
                        </div>
                    {:else}
                        {@render sectionHeader("Paleta de cores", "colors")}
                        <div class="flex h-20 overflow-hidden">
                            {#each allColors as color, i (color + i)}
                                <div
                                    class="group relative flex-1 transition-all duration-200 hover:flex-[2.5]"
                                    style="background-color: {color}"
                                >
                                    <span class="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap">
                                        {color}
                                    </span>
                                </div>
                            {/each}
                        </div>
                        {#if brandKit.primaryColors?.length && brandKit.secondaryColors?.length}
                            <div class="flex gap-6 mt-3 text-[10px] text-muted-foreground/40 uppercase tracking-wider">
                                <span>Primárias: {brandKit.primaryColors.length}</span>
                                <span>Secundárias: {brandKit.secondaryColors.length}</span>
                            </div>
                        {/if}
                    {/if}
                </div>
            {/if}

            <!-- Typography — 2/5 width -->
            {#if brandKit.typographyPrimary || brandKit.typographySecondary || editingSection === "typography"}
                <div class="lg:col-span-2 border border-t-0 lg:border-l-0 border-border bg-card px-8 py-6 board-section" style="--reveal-delay: 160ms">
                    {#if editingSection === "typography"}
                        {@render sectionHeader("Tipografia", "typography")}
                        <div class="space-y-4">
                            <div class="space-y-1">
                                <span class="text-[10px] uppercase tracking-wider text-muted-foreground/50">Títulos</span>
                                <Input
                                    class="bg-background"
                                    value={editDraft.typographyPrimary as string}
                                    oninput={(e) => { editDraft = { ...editDraft, typographyPrimary: e.currentTarget.value }; }}
                                    placeholder="Ex: Playfair Display"
                                />
                            </div>
                            <div class="space-y-1">
                                <span class="text-[10px] uppercase tracking-wider text-muted-foreground/50">Corpo</span>
                                <Input
                                    class="bg-background"
                                    value={editDraft.typographySecondary as string}
                                    oninput={(e) => { editDraft = { ...editDraft, typographySecondary: e.currentTarget.value }; }}
                                    placeholder="Ex: Inter"
                                />
                            </div>
                        </div>
                    {:else}
                        {@render sectionHeader("Tipografia", "typography")}
                        <div class="space-y-5">
                            {#if brandKit.typographyPrimary}
                                <div>
                                    <span class="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-1 block">Títulos</span>
                                    <p
                                        class="text-3xl font-bold leading-tight"
                                        style="font-family: {fontFamily(brandKit.typographyPrimary)}"
                                    >
                                        Aa Bb Cc
                                    </p>
                                    <span class="text-xs text-muted-foreground/60 mt-1 block">{brandKit.typographyPrimary}</span>
                                </div>
                            {/if}
                            {#if brandKit.typographySecondary}
                                <div>
                                    <span class="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-1 block">Corpo</span>
                                    <p
                                        class="text-lg leading-relaxed"
                                        style="font-family: {fontFamily(brandKit.typographySecondary)}"
                                    >
                                        Aa Bb Cc
                                    </p>
                                    <span class="text-xs text-muted-foreground/60 mt-1 block">{brandKit.typographySecondary}</span>
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
            {/if}
        </div>

        <!-- ── Row 3: Strategy + Voice — 2 columns ── -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-0">
            <!-- Strategy -->
            {#if brandKit.whatWeSell || brandKit.whoWeServe || audienceLabel || brandKit.differentiators || brandKit.competitorsNotes || editingSection === "strategy"}
                <div class="border border-t-0 border-border bg-card px-8 py-6 board-section" style="--reveal-delay: 240ms">
                    {#if editingSection === "strategy"}
                        {@render sectionHeader("Estratégia", "strategy")}
                        <div class="space-y-4">
                            <div class="space-y-1">
                                <span class="text-[10px] uppercase tracking-wider text-muted-foreground/50">O que oferece</span>
                                <Textarea
                                    class="min-h-[60px] resize-none bg-background text-sm"
                                    value={editDraft.whatWeSell as string}
                                    oninput={(e) => { editDraft = { ...editDraft, whatWeSell: e.currentTarget.value }; }}
                                />
                            </div>
                            <div class="space-y-1">
                                <span class="text-[10px] uppercase tracking-wider text-muted-foreground/50">Público</span>
                                <Textarea
                                    class="min-h-[60px] resize-none bg-background text-sm"
                                    value={editDraft.whoWeServe as string}
                                    oninput={(e) => { editDraft = { ...editDraft, whoWeServe: e.currentTarget.value }; }}
                                />
                            </div>
                            <div class="space-y-1">
                                <span class="text-[10px] uppercase tracking-wider text-muted-foreground/50">Diferenciais</span>
                                <Textarea
                                    class="min-h-[60px] resize-none bg-background text-sm"
                                    value={editDraft.differentiators as string}
                                    oninput={(e) => { editDraft = { ...editDraft, differentiators: e.currentTarget.value }; }}
                                />
                            </div>
                            <div class="space-y-1">
                                <span class="text-[10px] uppercase tracking-wider text-muted-foreground/50">Cenário competitivo</span>
                                <Textarea
                                    class="min-h-[60px] resize-none bg-background text-sm"
                                    value={editDraft.competitorsNotes as string}
                                    oninput={(e) => { editDraft = { ...editDraft, competitorsNotes: e.currentTarget.value }; }}
                                />
                            </div>
                        </div>
                    {:else}
                        {@render sectionHeader("Estratégia", "strategy")}
                        <div class="space-y-4">
                            {#if brandKit.whatWeSell}
                                <div>
                                    <span class="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-1 block">O que oferece</span>
                                    <p class="text-sm leading-relaxed text-foreground/80">{brandKit.whatWeSell}</p>
                                </div>
                            {/if}
                            {#if audienceLabel || brandKit.whoWeServe}
                                <div>
                                    <span class="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-1 block">Público</span>
                                    <p class="text-sm leading-relaxed text-foreground/80">{audienceLabel || brandKit.whoWeServe}</p>
                                </div>
                            {/if}
                            {#if brandKit.differentiators}
                                <div>
                                    <span class="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-1 block">Diferenciais</span>
                                    <p class="text-sm leading-relaxed text-foreground/80">{brandKit.differentiators}</p>
                                </div>
                            {/if}
                            {#if brandKit.competitorsNotes}
                                <div>
                                    <span class="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-1 block">Cenário competitivo</span>
                                    <p class="text-sm leading-relaxed text-foreground/80">{brandKit.competitorsNotes}</p>
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
            {/if}

            <!-- Voice -->
            {#if brandKit.toneAdjectives?.length || brandKit.writingRules || editingSection === "voice"}
                <div class="border border-t-0 lg:border-l-0 border-border bg-card px-8 py-6 board-section" style="--reveal-delay: 320ms">
                    {#if editingSection === "voice"}
                        {@render sectionHeader("Voz da marca", "voice")}
                        <div class="space-y-4">
                            <div>
                                <span class="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-2 block">Tom</span>
                                <div class="flex flex-wrap gap-2">
                                    {#each (editDraft.toneAdjectives as string[]) as tone, i}
                                        <div class="flex items-center gap-1">
                                            <input
                                                type="text"
                                                value={tone}
                                                oninput={(e) => updateToneAdjective(i, e.currentTarget.value)}
                                                class="w-28 bg-background border border-border px-2 py-1 text-xs"
                                            />
                                            <button type="button" class="p-0.5 text-muted-foreground/40 hover:text-destructive" onclick={() => removeToneAdjective(i)}>
                                                <X class="h-3 w-3" />
                                            </button>
                                        </div>
                                    {/each}
                                    <button type="button" class="flex h-7 items-center gap-1 border border-dashed border-border px-2 text-xs text-muted-foreground hover:text-foreground transition-colors" onclick={addToneAdjective}>
                                        <Plus class="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                            <div class="space-y-1">
                                <span class="text-[10px] uppercase tracking-wider text-muted-foreground/50">Regras de escrita</span>
                                <Textarea
                                    class="min-h-[80px] resize-none bg-background text-sm"
                                    value={editDraft.writingRules as string}
                                    oninput={(e) => { editDraft = { ...editDraft, writingRules: e.currentTarget.value }; }}
                                />
                            </div>
                        </div>
                    {:else}
                        {@render sectionHeader("Voz da marca", "voice")}
                        {#if brandKit.toneAdjectives?.length}
                            <div class="flex flex-wrap gap-2 mb-4">
                                {#each brandKit.toneAdjectives as tone (tone)}
                                    <span
                                        class="px-3 py-1.5 text-xs font-medium border"
                                        style="border-color: {primaryColor}40; color: {primaryColor}"
                                    >
                                        {tone}
                                    </span>
                                {/each}
                            </div>
                        {/if}
                        {#if brandKit.writingRules}
                            <p class="text-sm leading-relaxed text-foreground/70 whitespace-pre-line">{brandKit.writingRules}</p>
                        {/if}
                    {/if}
                </div>
            {/if}
        </div>

        <!-- ── Row 4: Details Footer — full width ── -->
        {#if brandKit.emojiPolicy || brandKit.ctaStyle || brandKit.languages?.length || brandKit.imageryGuidelines || vibeLabel || editingSection === "details"}
            <div class="border border-t-0 border-border bg-card/50 px-8 py-6 board-section" style="--reveal-delay: 400ms">
                {#if editingSection === "details"}
                    {@render sectionHeader("Detalhes", "details")}
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="space-y-1">
                            <span class="text-[10px] uppercase tracking-wider text-muted-foreground/50">Emojis</span>
                            <Textarea
                                class="min-h-[60px] resize-none bg-background text-xs"
                                value={editDraft.emojiPolicy as string}
                                oninput={(e) => { editDraft = { ...editDraft, emojiPolicy: e.currentTarget.value }; }}
                            />
                        </div>
                        <div class="space-y-1">
                            <span class="text-[10px] uppercase tracking-wider text-muted-foreground/50">CTA</span>
                            <Textarea
                                class="min-h-[60px] resize-none bg-background text-xs"
                                value={editDraft.ctaStyle as string}
                                oninput={(e) => { editDraft = { ...editDraft, ctaStyle: e.currentTarget.value }; }}
                            />
                        </div>
                        <div class="space-y-1 sm:col-span-2">
                            <span class="text-[10px] uppercase tracking-wider text-muted-foreground/50">Diretrizes de imagem</span>
                            <Textarea
                                class="min-h-[60px] resize-none bg-background text-xs"
                                value={editDraft.imageryGuidelines as string}
                                oninput={(e) => { editDraft = { ...editDraft, imageryGuidelines: e.currentTarget.value }; }}
                            />
                        </div>
                    </div>
                {:else}
                    {@render sectionHeader("Detalhes", "details")}
                    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                        {#if brandKit.emojiPolicy}
                            <div>
                                <span class="text-[10px] uppercase tracking-wider text-muted-foreground/40 block mb-0.5">Emojis</span>
                                <span class="text-foreground/70 leading-relaxed">{brandKit.emojiPolicy}</span>
                            </div>
                        {/if}
                        {#if brandKit.ctaStyle}
                            <div>
                                <span class="text-[10px] uppercase tracking-wider text-muted-foreground/40 block mb-0.5">CTA</span>
                                <span class="text-foreground/70 leading-relaxed">{brandKit.ctaStyle}</span>
                            </div>
                        {/if}
                        {#if brandKit.languages?.length}
                            <div>
                                <span class="text-[10px] uppercase tracking-wider text-muted-foreground/40 block mb-0.5">Idiomas</span>
                                <span class="text-foreground/70">{brandKit.languages.join(", ")}</span>
                            </div>
                        {/if}
                        {#if brandKit.imageryGuidelines}
                            <div class="sm:col-span-2 lg:col-span-3">
                                <span class="text-[10px] uppercase tracking-wider text-muted-foreground/40 block mb-0.5">Imagem</span>
                                <span class="text-foreground/70 leading-relaxed">{brandKit.imageryGuidelines}</span>
                            </div>
                        {/if}
                        {#if vibeLabel}
                            <div>
                                <span class="text-[10px] uppercase tracking-wider text-muted-foreground/40 block mb-0.5">Estilo</span>
                                <span class="text-foreground/70">{vibeLabel}</span>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        {/if}
    </div>
{/if}

<style>
    .board-section {
        animation: boardReveal 0.5s ease both;
        animation-delay: var(--reveal-delay, 0ms);
    }

    @keyframes boardReveal {
        from {
            opacity: 0;
            transform: translateY(6px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
</style>
