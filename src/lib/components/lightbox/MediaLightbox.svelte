<script lang="ts">
    import type { Id } from "../../../convex/_generated/dataModel.js";
    import EditImageModal from "$lib/components/studio/EditImageModal.svelte";
    import LightboxImage from "./LightboxImage.svelte";
    import { Badge, Button } from "$lib/components/ui";
    import { goto } from "$app/navigation";

    interface MediaItem {
        _id: Id<"media_items">;
        url: string | null;
        model?: string;
        sourceType: string;
        prompt?: string;
        width: number;
        height: number;
        aspectRatio?: string;
        resolution?: string;
        createdAt: number;
        storageId: Id<"_storage">;
        mimeType: string;
    }

    interface Props {
        items: MediaItem[];
        currentMediaId: string;
        onclose: () => void;
        onnavigate: (mediaId: string) => void;
    }

    let { items, currentMediaId, onclose, onnavigate }: Props = $props();

    let currentIndex = $derived(items.findIndex((i) => i._id === currentMediaId));
    let currentItem = $derived(currentIndex >= 0 ? items[currentIndex] : undefined);
    let canPrev = $derived(currentIndex > 0);
    let canNext = $derived(currentIndex < items.length - 1);

    const modelDisplayNames: Record<string, string> = {
        "google/gemini-2.5-flash-image": "Nano Banana",
        "google/gemini-3-pro-image-preview": "Nano Banana Pro",
        "bytedance-seed/seedream-4.5": "SeeDream v4.5",
        "black-forest-labs/flux.2-flex": "Flux 2 Flex",
        "openai/gpt-5-image": "GPT Image 1.5",
    };

    function handlePrev() {
        const prevItem = items[currentIndex - 1];
        if (canPrev && prevItem) {
            onnavigate(prevItem._id);
        }
    }

    function handleNext() {
        const nextItem = items[currentIndex + 1];
        if (canNext && nextItem) {
            onnavigate(nextItem._id);
        }
    }

    async function handleDownload() {
        if (!currentItem?.url) return;
        try {
            const response = await fetch(currentItem.url);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            const modelName = currentItem.model?.split("/").pop() ?? "image";
            const extension = blob.type.split("/").pop() ?? "png";
            link.download = `vanda-${modelName}-${Date.now()}.${extension}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Download failed:", err);
        }
    }

    function handleUseInPost() {
        if (!currentItem) return;
        goto(`/posts/create?mediaIds=${currentItem._id}`);
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.target instanceof HTMLTextAreaElement) return;
        if (e.key === "Escape") onclose();
        if (e.key === "ArrowLeft") handlePrev();
        if (e.key === "ArrowRight") handleNext();
    }

    $effect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    });

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) onclose();
    }

    function formatDate(timestamp: number): string {
        return new Date(timestamp).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function getSourceLabel(sourceType: string): string {
        switch (sourceType) {
            case 'generated': return 'Gerada por IA';
            case 'uploaded': return 'Upload manual';
            case 'edited': return 'Editada';
            case 'imported': return 'Importada';
            default: return sourceType;
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
    class="fixed inset-0 z-50 flex animate-in fade-in duration-150"
    role="dialog"
    aria-modal="true"
    aria-label="Visualizador de imagem"
>
    <!-- Backdrop -->
    <div
        class="absolute inset-0 bg-black/90"
        onclick={handleBackdropClick}
        onkeydown={(event) => event.key === "Enter" && onclose()}
        role="button"
        tabindex="0"
    ></div>

    <!-- Close -->
    <button
        type="button"
        aria-label="Fechar"
        class="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center text-white/70 hover:text-white"
        onclick={onclose}
    >
        <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    </button>

    <!-- Counter -->
    <div class="absolute left-4 top-4 z-10 text-sm text-white/70">
        <span>{currentIndex + 1} / {items.length}</span>
    </div>

    <!-- Content -->
    <div class="relative z-0 flex w-full">
        <!-- Image -->
        <LightboxImage
            imageUrl={currentItem?.url ?? null}
            width={currentItem?.width}
            height={currentItem?.height}
            {canPrev}
            {canNext}
            onprev={handlePrev}
            onnext={handleNext}
        />

        <!-- Sidebar -->
        {#if currentItem}
            <div class="flex w-96 shrink-0 flex-col border-l border-white/10 bg-background overflow-y-auto">
                <div class="p-6 space-y-6">
                    <!-- Metadata -->
                    <div class="space-y-3">
                        <h3 class="text-sm font-semibold">Detalhes</h3>

                        <div class="space-y-2 text-sm">
                            <div class="flex justify-between">
                                <span class="text-muted-foreground">Origem</span>
                                <span>{getSourceLabel(currentItem.sourceType)}</span>
                            </div>

                            {#if currentItem.model}
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">Modelo</span>
                                    <Badge variant="secondary" class="text-xs">
                                        {modelDisplayNames[currentItem.model] ?? currentItem.model.split("/").pop()}
                                    </Badge>
                                </div>
                            {/if}

                            <div class="flex justify-between">
                                <span class="text-muted-foreground">Dimensões</span>
                                <span>{currentItem.width} x {currentItem.height}</span>
                            </div>

                            {#if currentItem.aspectRatio}
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">Proporção</span>
                                    <span>{currentItem.aspectRatio}</span>
                                </div>
                            {/if}

                            <div class="flex justify-between">
                                <span class="text-muted-foreground">Data</span>
                                <span class="text-xs">{formatDate(currentItem.createdAt)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Prompt -->
                    {#if currentItem.prompt}
                        <div class="space-y-2">
                            <h3 class="text-sm font-semibold">Prompt</h3>
                            <p class="text-sm text-muted-foreground whitespace-pre-wrap">{currentItem.prompt}</p>
                        </div>
                    {/if}

                    <!-- Actions -->
                    <div class="space-y-2 border-t border-border pt-4">
                        <Button variant="outline" class="w-full justify-start gap-2" onclick={handleDownload}>
                            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            Baixar
                        </Button>

                        <Button variant="outline" class="w-full justify-start gap-2" onclick={handleUseInPost}>
                            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Usar em post
                        </Button>
                    </div>
                </div>
            </div>
        {/if}
    </div>
</div>
