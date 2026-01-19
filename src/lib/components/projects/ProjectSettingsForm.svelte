<script lang="ts">
    import { Button, Input, Label, Textarea, Separator } from "$lib/components/ui";
    import { TraitTagInput, ContextImageUploader, PlatformSelector } from "$lib/components/projects";
    import { useConvexClient } from "convex-svelte";
    import { api } from "../../../convex/_generated/api.js";
    import type { Id } from "../../../convex/_generated/dataModel.js";

    interface Project {
        _id: Id<"projects">;
        name: string;
        instagramUrl: string;
        instagramHandle?: string;
        profilePictureUrl?: string;
        profilePictureStorageUrl?: string | null;
        platform?: string;
        accountDescription?: string;
        brandTraits?: string[];
        additionalContext?: string;
    }

    interface Props {
        projectId: Id<"projects">;
        project: Project;
    }

    let { projectId, project }: Props = $props();

    const client = useConvexClient();

    // Form state - initialized from project data
    let name = $state("");
    let instagramUrl = $state("");
    let platform = $state("instagram");
    let accountDescription = $state("");
    let brandTraits = $state<string[]>([]);
    let additionalContext = $state("");

    // Track if form has been initialized
    let formInitialized = $state(false);

    // Profile picture upload state
    let profilePictureInputEl = $state<HTMLInputElement | null>(null);
    let isUploadingProfilePicture = $state(false);

    // Initialize form when project data loads
    $effect(() => {
        if (project && !formInitialized) {
            name = project.name ?? "";
            instagramUrl = project.instagramUrl ?? "";
            platform = project.platform ?? "instagram";
            accountDescription = project.accountDescription ?? "";
            brandTraits = project.brandTraits ?? [];
            additionalContext = project.additionalContext ?? "";
            formInitialized = true;
        }
    });

    // Reset form initialization when project changes
    $effect(() => {
        if (projectId) {
            formInitialized = false;
        }
    });

    // Saving state
    let isSaving = $state(false);
    let saveError = $state<string | null>(null);
    let saveSuccess = $state(false);

    // Profile picture upload
    async function handleProfilePictureSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;

        isUploadingProfilePicture = true;
        try {
            // Get upload URL
            const uploadUrl = await client.mutation(api.contextImages.generateUploadUrl, {});

            // Upload the file
            const response = await fetch(uploadUrl, {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            });

            if (!response.ok) {
                throw new Error("Falha ao fazer upload da imagem");
            }

            const { storageId } = await response.json();

            // Update project profile picture
            await client.mutation(api.projects.updateProfilePictureStorage, {
                projectId,
                storageId: storageId as Id<"_storage">,
            });
        } catch (err) {
            console.error("Profile picture upload failed:", err);
            saveError = err instanceof Error ? err.message : "Erro ao fazer upload da imagem";
        } finally {
            isUploadingProfilePicture = false;
            input.value = "";
        }
    }

    // Track if form has changes
    let hasChanges = $derived(
        project && (
            name !== project.name ||
            instagramUrl !== project.instagramUrl ||
            platform !== (project.platform ?? "instagram") ||
            accountDescription !== (project.accountDescription ?? "") ||
            JSON.stringify(brandTraits) !== JSON.stringify(project.brandTraits ?? []) ||
            additionalContext !== (project.additionalContext ?? "")
        )
    );

    async function handleSave() {
        if (!hasChanges || isSaving) return;

        isSaving = true;
        saveError = null;
        saveSuccess = false;

        try {
            const updateData: Parameters<typeof client.mutation<typeof api.projects.update>>[1] = {
                projectId,
                name: name.trim(),
                instagramUrl: instagramUrl.trim(),
                platform,
            };

            const trimmedDescription = accountDescription.trim();
            if (trimmedDescription) {
                updateData.accountDescription = trimmedDescription;
            }

            if (brandTraits.length > 0) {
                updateData.brandTraits = brandTraits;
            }

            const trimmedContext = additionalContext.trim();
            if (trimmedContext) {
                updateData.additionalContext = trimmedContext;
            }

            await client.mutation(api.projects.update, updateData);
            saveSuccess = true;
            setTimeout(() => saveSuccess = false, 3000);
        } catch (err) {
            console.error("Failed to save:", err);
            saveError = err instanceof Error ? err.message : "Erro ao salvar alteracoes";
        } finally {
            isSaving = false;
        }
    }

    // Get profile picture URL
    function getProfilePicture(): string | null {
        if (!project) return null;
        return project.profilePictureStorageUrl ?? project.profilePictureUrl ?? null;
    }
</script>

<div class="space-y-8">
    <!-- Header -->
    <div class="flex items-center gap-4">
        <!-- Profile picture (clickable for upload) -->
        <input
            bind:this={profilePictureInputEl}
            type="file"
            accept="image/*"
            class="hidden"
            onchange={handleProfilePictureSelect}
        />
        <button
            type="button"
            class="group relative h-16 w-16 overflow-hidden rounded-full border-2 border-border bg-muted transition-all hover:border-primary"
            onclick={() => profilePictureInputEl?.click()}
            disabled={isUploadingProfilePicture}
        >
            {#if isUploadingProfilePicture}
                <div class="flex h-full w-full items-center justify-center bg-muted">
                    <svg class="h-6 w-6 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
            {:else if getProfilePicture()}
                <img
                    src={getProfilePicture()}
                    alt={project.name}
                    class="h-full w-full object-cover"
                />
                <!-- Hover overlay -->
                <div class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <svg class="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                    </svg>
                </div>
            {:else}
                <div class="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground group-hover:text-primary">
                    {project.name.charAt(0).toUpperCase()}
                </div>
                <!-- Hover overlay for empty state -->
                <div class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <svg class="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                    </svg>
                </div>
            {/if}
        </button>
        <div>
            <h1 class="text-2xl font-bold">Configurações do Projeto</h1>
            <p class="text-muted-foreground">Configure o contexto da marca para geração de conteúdo</p>
        </div>
    </div>

    <!-- Basic Info Section -->
    <section class="border border-border bg-card p-6">
        <h2 class="text-lg font-semibold mb-4">Informações Básicas</h2>
        <div class="space-y-4">
            <div class="space-y-2">
                <Label for="name" class="text-sm font-medium">Nome do Projeto</Label>
                <Input
                    id="name"
                    bind:value={name}
                    placeholder="Ex: Minha Loja, Blog Pessoal..."
                    class="bg-background"
                />
            </div>

            <PlatformSelector
                value={platform}
                onchange={(p) => platform = p}
            />

            <div class="space-y-2">
                <Label for="instagram-url" class="text-sm font-medium">URL do Instagram</Label>
                <Input
                    id="instagram-url"
                    bind:value={instagramUrl}
                    placeholder="https://instagram.com/seu_perfil"
                    class="bg-background"
                />
            </div>
        </div>
    </section>

    <!-- Brand Context Section -->
    <section class="border border-border bg-card p-6">
        <h2 class="text-lg font-semibold mb-4">Contexto da Marca</h2>
        <div class="space-y-4">
            <div class="space-y-2">
                <Label for="account-description" class="text-sm font-medium">Sobre a Conta</Label>
                <Textarea
                    id="account-description"
                    bind:value={accountDescription}
                    placeholder="Descreva do que se trata esta conta. Qual é o nicho? Quem é o público-alvo? Qual é a proposta de valor?"
                    class="min-h-[100px] resize-none bg-background"
                />
                <p class="text-xs text-muted-foreground">
                    Esta descricao ajuda a IA a entender o proposito da sua conta
                </p>
            </div>

            <Separator />

            <TraitTagInput
                value={brandTraits}
                onchange={(traits) => brandTraits = traits}
            />

            <Separator />

            <div class="space-y-2">
                <Label for="additional-context" class="text-sm font-medium">Contexto Adicional</Label>
                <Textarea
                    id="additional-context"
                    bind:value={additionalContext}
                    placeholder="Informações adicionais que podem ser úteis para a geração de conteúdo. Ex: datas importantes, campanhas ativas, restrições, preferências de linguagem..."
                    class="min-h-[100px] resize-none bg-background"
                />
            </div>

            <Separator />

            <ContextImageUploader {projectId} />
        </div>
    </section>

    <!-- Save Button -->
    <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
            {#if saveError}
                <p class="text-sm text-destructive">{saveError}</p>
            {/if}
            {#if saveSuccess}
                <p class="text-sm text-green-600 flex items-center gap-1">
                    <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Alteracoes salvas
                </p>
            {/if}
        </div>
        <Button
            onclick={handleSave}
            disabled={!hasChanges || isSaving}
        >
            {#if isSaving}
                <svg class="h-4 w-4 animate-spin mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Salvando...
            {:else}
                Salvar Alteracoes
            {/if}
        </Button>
    </div>
</div>
