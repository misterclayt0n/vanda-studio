<script lang="ts">
    import { Button, Label } from "$lib/components/ui";
    import { useConvexClient, useQuery } from "convex-svelte";
    import { api } from "../../../convex/_generated/api.js";
    import type { Id } from "../../../convex/_generated/dataModel.js";

    interface Props {
        projectId: Id<"projects">;
    }

    let { projectId }: Props = $props();

    const client = useConvexClient();

    // Query existing context images
    const imagesQuery = useQuery(api.contextImages.list, () => ({ projectId }));
    let images = $derived(imagesQuery.data ?? []);

    let fileInputEl: HTMLInputElement;
    let isUploading = $state(false);
    let dragOver = $state(false);

    async function uploadFile(file: File): Promise<void> {
        if (!file.type.startsWith('image/')) return;

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

        // Save to database
        await client.mutation(api.contextImages.add, {
            projectId,
            storageId: storageId as Id<"_storage">,
        });
    }

    async function handleFiles(files: File[]) {
        if (files.length === 0) return;

        isUploading = true;
        try {
            await Promise.all(files.map(uploadFile));
        } catch (err) {
            console.error("Upload failed:", err);
        } finally {
            isUploading = false;
        }
    }

    function handleFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files) return;

        handleFiles(Array.from(input.files));
        input.value = "";
    }

    async function handleRemove(id: Id<"context_images">) {
        await client.mutation(api.contextImages.remove, { id });
    }

    function handleDrop(event: DragEvent) {
        event.preventDefault();
        dragOver = false;

        const files = event.dataTransfer?.files;
        if (files) {
            handleFiles(Array.from(files).filter(f => f.type.startsWith('image/')));
        }
    }

    function handleDragOver(event: DragEvent) {
        event.preventDefault();
        dragOver = true;
    }

    function handleDragLeave() {
        dragOver = false;
    }

    function handlePaste(event: ClipboardEvent) {
        const items = event.clipboardData?.items;
        if (!items) return;

        const imageFiles: File[] = [];
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    imageFiles.push(file);
                }
            }
        }

        if (imageFiles.length > 0) {
            event.preventDefault();
            handleFiles(imageFiles);
        }
    }
</script>

<svelte:window onpaste={handlePaste} />

<div class="space-y-3">
    <Label class="text-sm font-medium">Imagens de Referência</Label>

    <!-- Drop zone -->
    <div
        class="relative border-2 border-dashed transition-colors {dragOver ? 'border-primary bg-primary/5' : 'border-border bg-background'}"
        ondrop={handleDrop}
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        role="button"
        tabindex="0"
    >
        <input
            bind:this={fileInputEl}
            type="file"
            accept="image/*"
            multiple
            class="hidden"
            onchange={handleFileSelect}
        />

        <button
            type="button"
            class="flex w-full flex-col items-center justify-center gap-2 p-6 text-muted-foreground hover:text-foreground transition-colors"
            onclick={() => fileInputEl.click()}
            disabled={isUploading}
        >
            {#if isUploading}
                <svg class="h-8 w-8 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span class="text-sm">Enviando...</span>
            {:else}
                <svg class="h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                <span class="text-sm">Arraste imagens ou clique para selecionar</span>
                <span class="text-xs">Ctrl+V para colar da area de transferencia</span>
            {/if}
        </button>
    </div>

    <!-- Uploaded images -->
    {#if images.length > 0}
        <div class="flex flex-wrap gap-2">
            {#each images as image (image._id)}
                <div class="group relative">
                    <div class="h-20 w-20 overflow-hidden border border-border bg-muted">
                        {#if image.url}
                            <img
                                src={image.url}
                                alt="Imagem de contexto"
                                class="h-full w-full object-cover"
                            />
                        {:else}
                            <div class="flex h-full w-full items-center justify-center">
                                <svg class="h-6 w-6 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                </svg>
                            </div>
                        {/if}
                    </div>
                    <button
                        type="button"
                        aria-label="Remover imagem"
                        class="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        onclick={() => handleRemove(image._id)}
                    >
                        <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            {/each}
        </div>
    {/if}

    <p class="text-xs text-muted-foreground">
        Adicione imagens que representem o estilo visual da sua marca
    </p>
</div>
