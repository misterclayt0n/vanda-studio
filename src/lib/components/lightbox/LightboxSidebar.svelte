<script lang="ts">
    import { useQuery } from "convex-svelte";
    import { api } from "../../../convex/_generated/api.js";
    import type { Id } from "../../../convex/_generated/dataModel.js";
    import { Badge, Button } from "$lib/components/ui";
    import { EditableCaption } from "$lib/components/studio";
    import LightboxThumbnail from "./LightboxThumbnail.svelte";
    import LightboxConversationCard from "./LightboxConversationCard.svelte";

    interface Props {
        postId: Id<"generated_posts">;
        selectedImageId?: string | null;
        onselectimage: (imageId: string) => void;
        ondownload: () => void;
        onrefine: () => void;
    }

    let { postId, selectedImageId, onselectimage, ondownload, onrefine }: Props = $props();

    // Fetch full post data with images
    const postQuery = useQuery(api.generatedPosts.getWithHistory, () => ({ id: postId }));
    let post = $derived(postQuery.data);

    // Current image (default to first if none selected)
    let currentImage = $derived(
        selectedImageId
            ? post?.images?.find((i) => i._id === selectedImageId)
            : post?.images?.[0]
    );

    // Actual image dimensions (loaded from image file)
    let actualDimensions = $state<{ width: number; height: number } | null>(null);

    // Load actual dimensions when image URL changes
    $effect(() => {
        const url = currentImage?.url;
        if (url) {
            actualDimensions = null; // Reset while loading
            const img = new Image();
            img.onload = () => {
                actualDimensions = { width: img.naturalWidth, height: img.naturalHeight };
            };
            img.src = url;
        }
    });

    // Conversations for current image
    const conversationsQuery = useQuery(
        api.imageEditConversations.listBySourceImage,
        () => (currentImage?._id ? { sourceImageId: currentImage._id as Id<"generated_images"> } : "skip")
    );
    let conversations = $derived(conversationsQuery.data ?? []);


    // Model display names
    const modelDisplayNames: Record<string, string> = {
        "google/gemini-2.5-flash-image": "Nano Banana",
        "google/gemini-3-pro-image-preview": "Nano Banana Pro",
        "bytedance-seed/seedream-4.5": "SeeDream v4.5",
        "black-forest-labs/flux.2-flex": "Flux 2 Flex",
        "openai/gpt-5-image": "GPT Image 1.5",
    };

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

</script>

<aside
    class="flex w-[400px] shrink-0 flex-col overflow-y-auto border-l border-white/10 bg-background"
>
    {#if postQuery.isLoading}
        <!-- Loading state -->
        <div class="flex flex-1 items-center justify-center">
            <svg
                class="h-6 w-6 animate-spin text-primary"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
            >
                <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                ></circle>
                <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
            </svg>
        </div>
    {:else if post}
        <div class="flex flex-1 flex-col p-6">
            <!-- Model name -->
            <div class="flex items-center gap-2">
                <h2 class="text-xl font-semibold">
                    {modelDisplayNames[currentImage?.model ?? ""] ?? currentImage?.model?.split("/").pop() ?? "Imagem"}
                </h2>
            </div>

            <!-- Metadata -->
            <div class="mt-4 space-y-2 text-sm text-muted-foreground">
                {#if currentImage}
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
                            {:else}
                                {currentImage.width} x {currentImage.height}
                            {/if}
                        </span>
                    </div>
                {/if}
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
                    <span>{formatDate(post.createdAt)}</span>
                </div>
            </div>

            <!-- Actions -->
            <div class="mt-4 flex gap-2">
                <Button variant="outline" size="sm" class="flex-1" onclick={ondownload}>
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
                <Button variant="outline" size="sm" class="flex-1" onclick={onrefine}>
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
                            d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                        />
                    </svg>
                    Refinar
                </Button>
            </div>

            <!-- Legenda (Caption) -->
            {#if post.caption}
                <div class="mt-6">
                    <h3 class="text-sm font-medium text-foreground">Legenda</h3>
                    <div class="mt-2">
                        <EditableCaption
                            postId={postId}
                            caption={post.caption}
                            showHashtags={true}
                            showCharCount={false}
                        />
                    </div>
                </div>
            {/if}

            <!-- All outputs -->
            {#if post.images && post.images.length > 1}
                <div class="mt-6">
                    <h3 class="text-sm font-medium text-foreground">
                        Todas as saidas ({post.images.length})
                    </h3>
                    <div class="mt-3 grid grid-cols-3 gap-2">
                        {#each post.images as image (image._id)}
                            <LightboxThumbnail
                                url={image.url}
                                selected={image._id === currentImage?._id}
                                label={modelDisplayNames[image.model] ?? image.model.split("/").pop()}
                                onclick={() => onselectimage(image._id)}
                            />
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Conversations -->
            <div class="mt-6">
                <h3 class="text-sm font-medium text-foreground">
                    Conversas ({conversations.length})
                </h3>
                {#if conversationsQuery.isLoading}
                    <div class="mt-3 flex items-center justify-center py-4">
                        <svg
                            class="h-5 w-5 animate-spin text-muted-foreground"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                class="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                stroke-width="4"
                            ></circle>
                            <path
                                class="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                        </svg>
                    </div>
                {:else if conversations.length > 0}
                    <div class="mt-3 space-y-2">
                        {#each conversations as conv (conv._id)}
                            <LightboxConversationCard conversation={conv} />
                        {/each}
                    </div>
                {:else}
                    <p class="mt-3 text-sm text-muted-foreground">
                        Nenhuma conversa de edicao ainda
                    </p>
                {/if}

                <!-- Always show button to start new conversation -->
                <Button
                    variant="outline"
                    size="sm"
                    class="mt-3 w-full"
                    onclick={onrefine}
                >
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
                            d="M12 4.5v15m7.5-7.5h-15"
                        />
                    </svg>
                    Nova conversa
                </Button>
            </div>
        </div>
    {:else}
        <!-- Error/not found state -->
        <div class="flex flex-1 items-center justify-center p-6">
            <p class="text-sm text-muted-foreground">Post nao encontrado</p>
        </div>
    {/if}
</aside>
