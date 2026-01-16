<script lang="ts">
    interface Props {
        imageUrl: string | null;
        width?: number | undefined;
        height?: number | undefined;
        canPrev: boolean;
        canNext: boolean;
        onprev: () => void;
        onnext: () => void;
    }

    let { imageUrl, width = undefined, height = undefined, canPrev, canNext, onprev, onnext }: Props = $props();
</script>

<div class="relative flex flex-1 items-center justify-center p-8">
    <!-- Previous button -->
    {#if canPrev}
        <button
            type="button"
            aria-label="Imagem anterior"
            class="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            onclick={onprev}
        >
            <svg
                class="h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15.75 19.5L8.25 12l7.5-7.5"
                />
            </svg>
        </button>
    {/if}

    <!-- Image -->
    <div class="flex max-h-full max-w-full items-center justify-center">
        {#if imageUrl}
            <img
                src={imageUrl}
                alt=""
                class="max-h-[calc(100vh-8rem)] max-w-full object-contain"
                style={width && height ? `aspect-ratio: ${width} / ${height};` : ""}
            />
        {:else}
            <div
                class="flex aspect-square h-96 w-96 items-center justify-center bg-muted/20"
            >
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
            onclick={onnext}
        >
            <svg
                class="h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                />
            </svg>
        </button>
    {/if}
</div>
