<script lang="ts">
    import type { Id } from "../../../convex/_generated/dataModel.js";
    import EditImageModal from "$lib/components/studio/EditImageModal.svelte";
    import { ScheduleModal } from "$lib/components/calendar";
    import { useQuery } from "convex-svelte";
    import { api } from "../../../convex/_generated/api.js";
    import LightboxImage from "./LightboxImage.svelte";
    import LightboxSidebar from "./LightboxSidebar.svelte";

    interface GalleryPost {
        _id: Id<"generated_posts">;
        imageUrl: string | null;
        caption: string;
        imageModel?: string;
        createdAt: number;
    }

    interface GeneratedImage {
        _id: Id<"generated_images">;
        storageId: Id<"_storage">;
        model: string;
        url: string | null;
        prompt: string;
        width: number;
        height: number;
        aspectRatio?: string;
        resolution?: string;
    }

    interface Props {
        posts: GalleryPost[];
        currentPostId: string;
        currentImageId?: string | null;
        onclose: () => void;
        onnavigate: (postId: string, imageId?: string | null) => void;
    }

    let { posts, currentPostId, currentImageId = null, onclose, onnavigate }: Props = $props();

    // Find current index in posts array
    let currentIndex = $derived(posts.findIndex((p) => p._id === currentPostId));
    let currentPost = $derived(posts[currentIndex]);
    let canPrev = $derived(currentIndex > 0);
    let canNext = $derived(currentIndex < posts.length - 1);

    // Fetch full post data for current image
    const postQuery = useQuery(
        api.generatedPosts.getWithHistory,
        () => (currentPostId ? { id: currentPostId as Id<"generated_posts"> } : "skip")
    );
    let fullPost = $derived(postQuery.data);

    // Current image (for main display)
    let currentImage = $derived<GeneratedImage | undefined>(
        currentImageId
            ? fullPost?.images?.find((i: GeneratedImage) => i._id === currentImageId)
            : fullPost?.images?.[0]
    );

    // Edit modal state
    let editModalOpen = $state(false);
    let editModalImage = $state<GeneratedImage | null>(null);

    function openEditModal() {
        if (!currentImage) return;
        editModalImage = currentImage;
        editModalOpen = true;
    }

    function closeEditModal() {
        editModalOpen = false;
        editModalImage = null;
    }

    // Schedule modal state
    let scheduleModalOpen = $state(false);

    function openScheduleModal() {
        scheduleModalOpen = true;
    }

    function closeScheduleModal() {
        scheduleModalOpen = false;
    }

    // Navigation handlers
    function handlePrev() {
        const prevPost = posts[currentIndex - 1];
        if (canPrev && prevPost) {
            onnavigate(prevPost._id, null);
        }
    }

    function handleNext() {
        const nextPost = posts[currentIndex + 1];
        if (canNext && nextPost) {
            onnavigate(nextPost._id, null);
        }
    }

    function handleSelectImage(imageId: string) {
        onnavigate(currentPostId, imageId);
    }

    // Download handler
    async function handleDownload() {
        const imageUrl = currentImage?.url ?? currentPost?.imageUrl;
        if (!imageUrl) return;

        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;

            const modelName = currentImage?.model?.split("/").pop() ?? "image";
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

    // Keyboard handling
    function handleKeydown(e: KeyboardEvent) {
        // Don't handle if modals are open
        if (editModalOpen || scheduleModalOpen) return;

        // Don't handle if user is typing in a textarea (editing caption)
        if (e.target instanceof HTMLTextAreaElement) return;

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
        // Only close if clicking the backdrop itself, not children
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
    <div
        class="absolute left-4 top-4 z-10 flex items-center gap-2 text-sm text-white/70"
    >
        <span>{currentIndex + 1} / {posts.length}</span>
    </div>

    <!-- Main content -->
    <div class="relative z-0 flex w-full">
        <!-- Left: Image area -->
        <LightboxImage
            imageUrl={currentImage?.url ?? currentPost?.imageUrl ?? null}
            width={currentImage?.width}
            height={currentImage?.height}
            {canPrev}
            {canNext}
            onprev={handlePrev}
            onnext={handleNext}
        />

        <!-- Right: Sidebar -->
        {#if currentPost}
            <LightboxSidebar
                postId={currentPost._id}
                post={fullPost}
                selectedImageId={currentImageId}
                onselectimage={handleSelectImage}
                ondownload={handleDownload}
                onrefine={openEditModal}
                onschedule={openScheduleModal}
            />
        {/if}
    </div>
</div>

<!-- Edit Image Modal (rendered on top) -->
{#if editModalImage}
    <EditImageModal image={editModalImage} open={editModalOpen} onclose={closeEditModal} />
{/if}

<!-- Schedule Modal -->
{#if currentPost}
    <ScheduleModal
        open={scheduleModalOpen}
        onclose={closeScheduleModal}
        postId={currentPost._id}
        caption={fullPost?.caption ?? currentPost.caption}
        imageUrl={currentImage?.url ?? currentPost.imageUrl}
    />
{/if}
