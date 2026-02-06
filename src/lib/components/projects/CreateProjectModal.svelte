<script lang="ts">
    import { Button, Input, Label } from "$lib/components/ui";
    import { useConvexClient } from "convex-svelte";
    import { api } from "../../../convex/_generated/api.js";
    import type { Id } from "../../../convex/_generated/dataModel.js";

    interface Props {
        open: boolean;
        onclose: () => void;
        oncreated?: (projectId: Id<"projects">) => void;
    }

    let { open, onclose, oncreated }: Props = $props();

    const client = useConvexClient();

    // Form state
    let name = $state("");
    let instagramUrl = $state("");
    let isSubmitting = $state(false);
    let error = $state<string | null>(null);

    // Validation
    let isValid = $derived(name.trim().length > 0 && instagramUrl.trim().length > 0);

    async function handleSubmit() {
        if (!isValid || isSubmitting) return;

        isSubmitting = true;
        error = null;

        try {
            const projectId = await client.mutation(api.projects.create, {
                name: name.trim(),
                instagramUrl: instagramUrl.trim(),
            });

            // Reset form
            name = "";
            instagramUrl = "";

            oncreated?.(projectId);
            onclose();
        } catch (err) {
            console.error("Failed to create project:", err);
            error = err instanceof Error ? err.message : "Erro ao criar projeto";
        } finally {
            isSubmitting = false;
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Escape") {
            handleClose();
        }
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            handleSubmit();
        }
    }

    function handleClose() {
        name = "";
        instagramUrl = "";
        error = null;
        onclose();
    }
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
    <!-- Backdrop -->
    <div
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onclick={handleClose}
        onkeydown={(e) => e.key === "Enter" && handleClose()}
        role="button"
        tabindex="0"
    ></div>

    <!-- Modal -->
    <div class="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md border border-border bg-background shadow-xl">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
                <h2 class="text-lg font-semibold">Novo Projeto</h2>
                <p class="text-sm text-muted-foreground">Adicione uma conta Instagram</p>
            </div>
            <button
                type="button"
                aria-label="Fechar"
                class="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                onclick={handleClose}
            >
                <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-4">
            {#if error}
                <div class="border border-destructive/50 bg-destructive/10 p-3">
                    <p class="text-sm text-destructive">{error}</p>
                </div>
            {/if}

            <div class="space-y-2">
                <Label for="project-name" class="text-sm font-medium">Nome do Projeto</Label>
                <Input
                    id="project-name"
                    bind:value={name}
                    placeholder="Ex: Minha Loja, Blog Pessoal..."
                    class="bg-background"
                />
            </div>

            <div class="space-y-2">
                <Label for="instagram-url" class="text-sm font-medium">URL do Instagram</Label>
                <Input
                    id="instagram-url"
                    bind:value={instagramUrl}
                    placeholder="https://instagram.com/seu_perfil"
                    class="bg-background"
                />
                <p class="text-xs text-muted-foreground">
                    Cole o link do perfil do Instagram que será usado como referência
                </p>
            </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
            <Button variant="outline" onclick={handleClose} disabled={isSubmitting}>
                Cancelar
            </Button>
            <Button onclick={handleSubmit} disabled={!isValid || isSubmitting}>
                {#if isSubmitting}
                    <svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Criando...
                {:else}
                    Criar Projeto
                {/if}
            </Button>
        </div>
    </div>
{/if}
