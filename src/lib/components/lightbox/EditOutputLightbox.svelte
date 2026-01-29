<script lang="ts">
    import { Button } from "$lib/components/ui";

    interface OutputImage {
        id: string;
        url: string;
        model: string;
        width?: number;
        height?: number;
        createdAt?: number;
    }

    interface Props {
        images: OutputImage[];
        currentIndex: number;
        onclose: () => void;
        onnavigate: (index: number) => void;
    }

    let { images, currentIndex, onclose, onnavigate }: Props = $props();

    let currentImage = $derived(images[currentIndex]);
    let canPrev = $derived(currentIndex > 0);
    let canNext = $derived(currentIndex < images.length - 1);

    // Actual image dimensions (loaded from image file)
    let actualDimensions = $state<{ width: number; height: number } | null>(null);

    // Load actual dimensions when image URL changes
    $effect(() => {
        const url = currentImage?.url;
        if (url) {
            actualDimensions = null;
            const img = new Image();
            img.onload = () => {
                actualDimensions = { width: img.naturalWidth, height: img.naturalHeight };
            };
            img.src = url;
        }
    });

    // Model display names
    const modelDisplayNames: Record<string, string> = {
        "google/gemini-2.5-flash-image": "Nano Banana",
        "google/gemini-3-pro-image-preview": "Nano Banana Pro",
        "bytedance-seed/seedream-4.5": "SeeDream v4.5",
        "black-forest-labs/flux.2-flex": "Flux 2 Flex",
        "openai/gpt-5-image": "GPT Image 1.5",
    };

    function getModelDisplayName(model: string): string {
        return modelDisplayNames[model] ?? model.split("/").pop() ?? model;
    }

    // Format date
    function formatDate(timestamp: number): string {
        const date = new Date(timestamp);
        return date.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    // Navigation handlers
    function handlePrev() {
        if (canPrev) {
            onnavigate(currentIndex - 1);
        }
    }

    function handleNext() {
        if (canNext) {
            onnavigate(currentIndex + 1);
        }
    }

    // Download handler
    async function handleDownload() {
        if (!currentImage?.url) return;

        try {
            const response = await fetch(currentImage.url);
            const blob = await response.blob();

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;

            const modelName = currentImage.model.split("/").pop() ?? "image";
            const extension = blob.type.split("/").pop() ?? "png";
            link.download = `vanda-edit-${modelName}-${Date.now()}.${extension}`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Download failed:", err);
        }
    }

    // Keyboard handling
    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            onclose();
        }
        if (e.key === "ArrowLeft") {
            handlePrev();
        }
        if (e.key === "ArrowRight") {
            handleNext();
        }
    }

    // Prevent body scroll when lightbox is open
    $effect(() => {
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    });

    // Handle backdrop click
    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) {
            onclose();
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Full screen overlay -->
<div
    class="fixed inset-0 z-50 flex animate-in fade-in duration-150"
    role="dialog"
    aria-modal="true"
    aria-label="Visualizador de imagem"
>
    <!-- Dark backdrop -->
    <div
        class="absolute inset-0 bg-black/90"
        onclick={handleBackdropClick}
        onkeydown={(e) => e.key === "Enter" && onclose()}
        role="button"
        tabindex="-1"
    ></div>

    <!-- Close button -->
    <button
        type="button"
        aria-label="Fechar"
        class="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center text-white/70 transition-colors hover:text-white"
        onclick={onclose}
    >
        <svg
            class="h-6 w-6"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
        >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    </button>

    <!-- Navigation counter -->
    {#if images.length > 1}
        <div class="absolute left-4 top-4 z-10 flex items-center gap-2 text-sm text-white/70">
            <span>{currentIndex + 1} / {images.length}</span>
        </div>
    {/if}

    <!-- Main content -->
    <div class="relative z-0 flex w-full">
        <!-- Left: Image area -->
        <div class="relative flex flex-1 items-center justify-center p-8">
            <!-- Previous button -->
            {#if canPrev}
                <button
                    type="button"
                    aria-label="Imagem anterior"
                    class="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                    onclick={handlePrev}
                >
                    <svg
                        class="h-6 w-6"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                        stroke="currentColor"
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                </button>
            {/if}

            <!-- Image -->
            <div class="flex max-h-full max-w-full items-center justify-center">
                {#if currentImage?.url}
                    <img
                        src={currentImage.url}
                        alt=""
                        class="max-h-[calc(100vh-8rem)] max-w-full object-contain"
                        style={currentImage.width && currentImage.height ? `aspect-ratio: ${currentImage.width} / ${currentImage.height};` : ""}
                    />
                {:else}
                    <div class="flex aspect-square h-96 w-96 items-center justify-center bg-muted/20">
                        <svg
                            class="h-16 w-16 text-muted-foreground/50"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                            />
                        </svg>
                    </div>
                {/if}
            </div>

            <!-- Next button -->
            {#if canNext}
                <button
                    type="button"
                    aria-label="Proxima imagem"
                    class="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                    onclick={handleNext}
                >
                    <svg
                        class="h-6 w-6"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                        stroke="currentColor"
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                </button>
            {/if}
        </div>

        <!-- Right: Sidebar -->
        <aside class="flex w-[400px] shrink-0 flex-col overflow-y-auto border-l border-white/10 bg-background">
            <div class="flex flex-1 flex-col p-6">
                <!-- Model name -->
                <h2 class="text-xl font-semibold">
                    {getModelDisplayName(currentImage?.model ?? "")}
                </h2>

                <!-- Metadata -->
                <div class="mt-4 space-y-2 text-sm text-muted-foreground">
                    <!-- Dimensions -->
                    <div class="flex items-center gap-2">
                        <svg
                            class="h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                            />
                        </svg>
                        <span class="font-mono">
                            {#if actualDimensions}
                                {actualDimensions.width} x {actualDimensions.height}
                            {:else if currentImage?.width && currentImage?.height}
                                {currentImage.width} x {currentImage.height}
                            {:else}
                                --
                            {/if}
                        </span>
                    </div>

                    <!-- Date -->
                    {#if currentImage?.createdAt}
                        <div class="flex items-center gap-2">
                            <svg
                                class="h-4 w-4"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="1.5"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                                />
                            </svg>
                            <span>{formatDate(currentImage.createdAt)}</span>
                        </div>
                    {/if}
                </div>

                <!-- Download button -->
                <div class="mt-6">
                    <Button variant="outline" class="w-full" onclick={handleDownload}>
                        <svg
                            class="h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                            />
                        </svg>
                        Baixar
                    </Button>
                </div>

                <!-- All outputs thumbnails -->
                {#if images.length > 1}
                    <div class="mt-6">
                        <h3 class="text-sm font-medium text-foreground">
                            Todas as saidas ({images.length})
                        </h3>
                        <div class="mt-3 grid grid-cols-3 gap-2">
                            {#each images as image, index (image.id)}
                                <button
                                    type="button"
                                    class="group relative aspect-square overflow-hidden border-2 transition-colors {index === currentIndex ? 'border-primary' : 'border-border hover:border-primary/50'}"
                                    onclick={() => onnavigate(index)}
                                >
                                    <img
                                        src={image.url}
                                        alt={getModelDisplayName(image.model)}
                                        class="h-full w-full object-cover"
                                    />
                                    <div class="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5">
                                        <span class="text-[10px] text-white">{getModelDisplayName(image.model)}</span>
                                    </div>
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        </aside>
    </div>
</div>
