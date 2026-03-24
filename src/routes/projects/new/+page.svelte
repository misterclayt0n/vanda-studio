<script lang="ts">
    import { goto } from "$app/navigation";
    import Navbar from "$lib/components/Navbar.svelte";
    import { BrandKitEditor } from "$lib/components/projects";
    import { Button, Input, Label, Textarea } from "$lib/components/ui";
    import { emptyBrandKit, mergeBrandSuggestion, type BrandKitState } from "$lib/types/brandKit";
    import { useConvexClient } from "convex-svelte";
    import { api } from "../../../convex/_generated/api.js";
    import { SignedIn, SignedOut, SignInButton } from "svelte-clerk";

    const client = useConvexClient();

    type Step = 0 | 1 | 2 | 3;
    type Path = "existing" | "new" | null;

    let step = $state<Step>(0);
    let path = $state<Path>(null);
    let projectName = $state("");
    let websiteUrl = $state("");
    let nicheHint = $state("");
    let audienceHint = $state("");
    let referenceBrands = $state("");
    let userDescription = $state("");
    let brandKit = $state<BrandKitState>(emptyBrandKit());
    let instagramUrl = $state("");
    let isIngesting = $state(false);
    let isFullAi = $state(false);
    let isCreating = $state(false);
    let error = $state<string | null>(null);
    let ingestWarnings = $state<string[]>([]);

    let draftExtra = $derived.by(() => {
        if (path === "existing") {
            const parts = [`Caminho: marca existente`];
            if (websiteUrl.trim()) parts.push(`Site: ${websiteUrl.trim()}`);
            return parts.join("\n");
        }
        if (path === "new") {
            const parts = [`Caminho: criar marca`];
            if (nicheHint.trim()) parts.push(`Nicho: ${nicheHint.trim()}`);
            if (audienceHint.trim()) parts.push(`Público: ${audienceHint.trim()}`);
            if (referenceBrands.trim()) parts.push(`Referências: ${referenceBrands.trim()}`);
            if (userDescription.trim()) parts.push(`Descrição:\n${userDescription.trim()}`);
            return parts.join("\n");
        }
        return "";
    });

    function nextFromPath() {
        error = null;
        if (!path) {
            error = "Escolha uma opção.";
            return;
        }
        step = 1;
    }

    function nextFromBasics() {
        error = null;
        if (!projectName.trim()) {
            error = "Informe o nome do projeto.";
            return;
        }
        step = 2;
    }

    function back() {
        error = null;
        if (step > 0) step = (step - 1) as Step;
    }

    async function handleIngestWebsite() {
        if (!websiteUrl.trim()) {
            error = "Informe a URL do site.";
            return;
        }
        error = null;
        ingestWarnings = [];
        isIngesting = true;
        try {
            const res = await client.action(api.ai.brandOnboarding.ingestWebsiteForBrand, {
                url: websiteUrl.trim(),
            });
            brandKit = mergeBrandSuggestion(brandKit, res.suggestion as Record<string, unknown>);
            ingestWarnings = res.warnings ?? [];
        } catch (e) {
            error = e instanceof Error ? e.message : "Falha ao analisar o site";
        } finally {
            isIngesting = false;
        }
    }

    async function handleFullBrandAi() {
        const desc =
            path === "new"
                ? userDescription.trim()
                : [brandKit.elevatorPitch, brandKit.whatWeSell, draftExtra].filter(Boolean).join("\n\n");
        if (!desc) {
            error = path === "new" ? "Escreva uma descrição da marca." : "Preencha algum contexto antes.";
            return;
        }
        error = null;
        isFullAi = true;
        try {
            const aiArgs: {
                description: string;
                nicheHint?: string;
                audienceHint?: string;
                referenceBrands?: string;
            } = { description: desc };
            const nh = nicheHint.trim();
            if (nh) aiArgs.nicheHint = nh;
            const ah = audienceHint.trim();
            if (ah) aiArgs.audienceHint = ah;
            const rb = referenceBrands.trim();
            if (rb) aiArgs.referenceBrands = rb;
            const res = await client.action(api.ai.brandOnboarding.suggestBrandKitFromDescription, aiArgs);
            brandKit = mergeBrandSuggestion(brandKit, res as Record<string, unknown>);
        } catch (e) {
            error = e instanceof Error ? e.message : "Falha ao gerar sugestões";
        } finally {
            isFullAi = false;
        }
    }

    function cleanBrandKit(kit: BrandKitState): BrandKitState {
        const e = Object.fromEntries(
            Object.entries(kit).filter(([, v]) => {
                if (v === undefined || v === null) return false;
                if (typeof v === "string" && !v.trim()) return false;
                if (Array.isArray(v) && v.length === 0) return false;
                return true;
            })
        ) as BrandKitState;
        return e;
    }

    async function handleCreate() {
        if (!projectName.trim()) {
            error = "Nome do projeto é obrigatório.";
            return;
        }
        error = null;
        isCreating = true;
        try {
            const kit = cleanBrandKit(brandKit);
            const legacyDesc =
                kit.elevatorPitch?.trim() ||
                (path === "new" ? userDescription.trim().slice(0, 2000) : undefined);
            const legacyTraits = kit.toneAdjectives?.length ? kit.toneAdjectives : undefined;
            const legacyExtra = [kit.writingRules, kit.competitorsNotes, kit.imageryGuidelines]
                .filter((x) => x && String(x).trim())
                .join("\n\n");

            const createArgs: {
                name: string;
                onboardingStatus: "complete";
                instagramUrl?: string;
                brandKit?: BrandKitState;
                onboardingPath?: "existing" | "new";
                accountDescription?: string;
                brandTraits?: string[];
                additionalContext?: string;
            } = {
                name: projectName.trim(),
                onboardingStatus: "complete",
            };
            const ig = instagramUrl.trim();
            if (ig) createArgs.instagramUrl = ig;
            if (Object.keys(kit).length > 0) createArgs.brandKit = kit;
            if (path) createArgs.onboardingPath = path;
            if (legacyDesc) createArgs.accountDescription = legacyDesc;
            if (legacyTraits) createArgs.brandTraits = legacyTraits;
            const le = legacyExtra.trim();
            if (le) createArgs.additionalContext = le;
            const id = await client.mutation(api.projects.create, createArgs);
            goto(`/projects/${id}`);
        } catch (e) {
            error = e instanceof Error ? e.message : "Não foi possível criar o projeto";
        } finally {
            isCreating = false;
        }
    }
</script>

<svelte:head>
    <title>Novo projeto - Vanda Studio</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-background">
    <Navbar />

    <main class="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <SignedOut>
            <div class="flex flex-col items-center gap-4 py-16 text-center">
                <h1 class="text-xl font-semibold">Entre para criar um projeto</h1>
                <SignInButton mode="modal">
                    <button
                        class="h-9 rounded-none bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        Entrar
                    </button>
                </SignInButton>
            </div>
        </SignedOut>

        <SignedIn>
            <div class="mb-8 flex items-center justify-between gap-4">
                <Button variant="ghost" size="sm" onclick={() => goto("/projects")}>
                    ← Projetos
                </Button>
                <span class="text-xs text-muted-foreground">Passo {step + 1} de 4</span>
            </div>

            {#if error}
                <div class="mb-6 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                </div>
            {/if}

            {#if step === 0}
                <h1 class="text-2xl font-semibold">Novo projeto</h1>
                <p class="mt-2 text-sm text-muted-foreground">
                    A Vanda usa o contexto da sua marca em todo o conteúdo. Por onde quer começar?
                </p>
                <div class="mt-8 grid gap-4 sm:grid-cols-2">
                    <button
                        type="button"
                        class="border border-border bg-card p-6 text-left transition-colors hover:border-primary hover:bg-muted/30 {path ===
                        'existing'
                            ? 'border-primary ring-1 ring-primary'
                            : ''}"
                        onclick={() => (path = "existing")}
                    >
                        <h2 class="font-medium">Já tenho uma marca</h2>
                        <p class="mt-2 text-sm text-muted-foreground">
                            Site, cores, tom de voz — você preenche e a Vanda ajuda onde quiser.
                        </p>
                    </button>
                    <button
                        type="button"
                        class="border border-border bg-card p-6 text-left transition-colors hover:border-primary hover:bg-muted/30 {path ===
                        'new'
                            ? 'border-primary ring-1 ring-primary'
                            : ''}"
                        onclick={() => (path = "new")}
                    >
                        <h2 class="font-medium">Quero criar uma marca</h2>
                        <p class="mt-2 text-sm text-muted-foreground">
                            Descreva a ideia e a Vanda sugere paleta, tipografia e voz.
                        </p>
                    </button>
                </div>
                <div class="mt-10 flex justify-end gap-3">
                    <Button variant="outline" onclick={() => goto("/projects")}>Cancelar</Button>
                    <Button onclick={nextFromPath}>Continuar</Button>
                </div>
            {:else if step === 1}
                <h1 class="text-2xl font-semibold">Informações iniciais</h1>
                <p class="mt-2 text-sm text-muted-foreground">
                    {path === "existing"
                        ? "Nome do projeto e, se quiser, o site para a Vanda analisar."
                        : "Nome e uma visão geral do que você quer transmitir."}
                </p>
                <div class="mt-8 space-y-6 border border-border bg-card p-6">
                    <div class="space-y-2">
                        <Label for="pname">Nome do projeto</Label>
                        <Input
                            id="pname"
                            class="bg-background"
                            bind:value={projectName}
                            placeholder="Ex: Studio Aurora"
                        />
                    </div>

                    {#if path === "existing"}
                        <div class="space-y-2">
                            <Label for="web">Site da marca (opcional)</Label>
                            <div class="flex flex-col gap-2 sm:flex-row">
                                <Input
                                    id="web"
                                    class="flex-1 bg-background"
                                    bind:value={websiteUrl}
                                    placeholder="https://"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isIngesting}
                                    onclick={handleIngestWebsite}
                                >
                                    {isIngesting ? "Analisando…" : "Vanda analisa o site"}
                                </Button>
                            </div>
                            {#if ingestWarnings.length > 0}
                                <ul class="list-inside list-disc text-xs text-amber-700 dark:text-amber-400">
                                    {#each ingestWarnings as w}
                                        <li>{w}</li>
                                    {/each}
                                </ul>
                            {/if}
                        </div>
                    {:else}
                        <div class="grid gap-4 sm:grid-cols-2">
                            <div class="space-y-2">
                                <Label for="niche">Nicho (opcional)</Label>
                                <Input id="niche" class="bg-background" bind:value={nicheHint} />
                            </div>
                            <div class="space-y-2">
                                <Label for="aud">Público (opcional)</Label>
                                <Input id="aud" class="bg-background" bind:value={audienceHint} />
                            </div>
                        </div>
                        <div class="space-y-2">
                            <Label for="ref">Marcas de referência (opcional)</Label>
                            <Input id="ref" class="bg-background" bind:value={referenceBrands} />
                        </div>
                        <div class="space-y-2">
                            <Label for="desc">Descreva a marca que você imagina</Label>
                            <Textarea
                                id="desc"
                                class="min-h-[140px] resize-none bg-background"
                                bind:value={userDescription}
                                placeholder="Produtos, valores, personalidade, o que não pode faltar..."
                            />
                        </div>
                    {/if}
                </div>
                <div class="mt-10 flex justify-between gap-3">
                    <Button variant="outline" onclick={back}>Voltar</Button>
                    <Button onclick={nextFromBasics}>Continuar</Button>
                </div>
            {:else if step === 2}
                <h1 class="text-2xl font-semibold">Kit de marca</h1>
                <p class="mt-2 text-sm text-muted-foreground">
                    Ajuste os campos manualmente ou use os botões “Vanda preenche” em cada bloco.
                </p>
                <div class="mt-6 flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isFullAi}
                        onclick={handleFullBrandAi}
                    >
                        {isFullAi ? "Gerando…" : "Completar kit com a Vanda"}
                    </Button>
                </div>
                <div class="mt-6">
                    <BrandKitEditor
                        bind:brandKit
                        projectName={projectName.trim() || "Projeto"}
                        draftExtra={draftExtra}
                    />
                </div>
                <div class="mt-10 flex justify-between gap-3">
                    <Button variant="outline" onclick={back}>Voltar</Button>
                    <Button onclick={() => (step = 3)}>Continuar</Button>
                </div>
            {:else}
                <h1 class="text-2xl font-semibold">Instagram (opcional)</h1>
                <p class="mt-2 text-sm text-muted-foreground">
                    Você pode conectar depois em Configurações do projeto. Se já tiver o link, cole aqui.
                </p>
                <div class="mt-8 space-y-4 border border-border bg-card p-6">
                    <div class="space-y-2">
                        <Label for="ig">URL do Instagram</Label>
                        <Input
                            id="ig"
                            class="bg-background"
                            bind:value={instagramUrl}
                            placeholder="https://instagram.com/seu_perfil"
                        />
                    </div>
                </div>
                <div class="mt-10 flex justify-between gap-3">
                    <Button variant="outline" onclick={back}>Voltar</Button>
                    <Button onclick={handleCreate} disabled={isCreating}>
                        {isCreating ? "Criando…" : "Criar projeto"}
                    </Button>
                </div>
            {/if}
        </SignedIn>
    </main>
</div>
