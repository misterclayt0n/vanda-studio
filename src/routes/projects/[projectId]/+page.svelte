<script lang="ts">
    import { Button, Badge, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "$lib/components/ui";
    import { ProjectSettingsForm } from "$lib/components/projects";
    import { SignedIn, SignedOut, SignInButton } from "svelte-clerk";
    import { useConvexClient, useQuery } from "convex-svelte";
    import { api } from "../../../convex/_generated/api.js";
    import type { Id } from "../../../convex/_generated/dataModel.js";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import Navbar from "$lib/components/Navbar.svelte";
    import { Lightbox } from "$lib/components/lightbox";

    const client = useConvexClient();

    // Get projectId from route params
    let projectId = $derived($page.params.projectId as Id<"projects">);

    // Queries
    const projectQuery = useQuery(api.projects.get, () => ({ projectId }));
    const postsQuery = useQuery(api.generatedPosts.listByProject, () => ({ projectId }));
    const postCountQuery = useQuery(api.generatedPosts.countByProject, () => ({ projectId }));

    // Derived data
    let project = $derived(projectQuery.data);
    let posts = $derived(postsQuery.data ?? []);
    let postCount = $derived(postCountQuery.data ?? 0);
    let isLoading = $derived(projectQuery.isLoading);

    // View mode state
    type ViewMode = "gallery" | "settings";
    let viewMode = $state<ViewMode>("gallery");

    // Delete confirmation state
    let showDeleteConfirm = $state(false);
    let isDeleting = $state(false);

    // Lightbox state from URL params
    let lightboxPostId = $derived($page.url.searchParams.get('view'));
    let lightboxImageId = $derived($page.url.searchParams.get('img'));
    let lightboxOpen = $derived(!!lightboxPostId);

    // Open lightbox
    function openLightbox(postId: string, imageId?: string | null) {
        const url = new URL($page.url);
        url.searchParams.set('view', postId);
        if (imageId) {
            url.searchParams.set('img', imageId);
        } else {
            url.searchParams.delete('img');
        }
        goto(url.toString(), { replaceState: true, noScroll: true });
    }

    // Close lightbox
    function closeLightbox() {
        const url = new URL($page.url);
        url.searchParams.delete('view');
        url.searchParams.delete('img');
        goto(url.toString(), { replaceState: true, noScroll: true });
    }

    // Navigate within lightbox
    function navigateLightbox(postId: string, imageId?: string | null) {
        const url = new URL($page.url);
        url.searchParams.set('view', postId);
        if (imageId) {
            url.searchParams.set('img', imageId);
        } else {
            url.searchParams.delete('img');
        }
        goto(url.toString(), { replaceState: true, noScroll: true });
    }

    // Get profile picture URL
    function getProfilePicture(): string | null {
        if (!project) return null;
        return project.profilePictureStorageUrl ?? project.profilePictureUrl ?? null;
    }

    // Get handle
    function getHandle(): string | null {
        if (!project) return null;
        if (project.instagramHandle) return project.instagramHandle;
        try {
            const url = new URL(project.instagramUrl);
            const parts = url.pathname.split('/').filter(Boolean);
            return parts[0] ?? null;
        } catch {
            return null;
        }
    }

    // Format date
    function formatDate(timestamp: number): string {
        const date = new Date(timestamp);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
    }

    // Truncate caption
    function truncateCaption(caption: string, maxLength: number = 100): string {
        if (caption.length <= maxLength) return caption;
        return caption.substring(0, maxLength).trim() + '...';
    }

    // Model display names
    const modelDisplayNames: Record<string, string> = {
        "google/gemini-2.5-flash-image": "Nano Banana",
        "google/gemini-3-pro-image-preview": "Nano Banana Pro",
        "bytedance-seed/seedream-4.5": "SeeDream v4.5",
        "black-forest-labs/flux.2-flex": "Flux 2 Flex",
        "openai/gpt-5-image": "GPT Image 1.5",
    };

    // Handle delete
    async function handleDelete() {
        isDeleting = true;
        try {
            await client.mutation(api.projects.remove, { projectId });
            goto('/projects');
        } catch (err) {
            console.error("Failed to delete project:", err);
        } finally {
            isDeleting = false;
        }
    }

    // Handle download
    async function handleDownload(imageUrl: string, event: Event) {
        event.stopPropagation();
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `vanda-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download failed:', err);
        }
    }

    // Handle delete post
    async function handleDeletePost(postId: Id<"generated_posts">, event: Event) {
        event.stopPropagation();
        await client.mutation(api.generatedPosts.softDelete, { id: postId });
    }
</script>

<svelte:head>
    <title>{project?.name ?? 'Projeto'} - Vanda Studio</title>
</svelte:head>

<div class="flex h-screen flex-col bg-background">
    <Navbar />

    <SignedOut>
        <div class="flex flex-1 flex-col items-center justify-center gap-6 py-20">
            <div class="text-center">
                <h2 class="text-2xl font-bold">Entre para ver este projeto</h2>
                <p class="mt-2 text-muted-foreground">
                    Faca login para acessar seus projetos
                </p>
            </div>
            <SignInButton mode="modal">
                <button class="h-9 rounded-none bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                    Entrar
                </button>
            </SignInButton>
        </div>
    </SignedOut>

    <SignedIn>
        {#if isLoading}
            <div class="flex flex-1 items-center justify-center">
                <div class="flex flex-col items-center gap-4">
                    <svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p class="text-sm text-muted-foreground">Carregando projeto...</p>
                </div>
            </div>
        {:else if !project}
            <div class="flex flex-1 flex-col items-center justify-center gap-4 py-20">
                <div class="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-border bg-muted/50">
                    <svg class="h-8 w-8 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                </div>
                <h3 class="text-lg font-medium">Projeto nao encontrado</h3>
                <p class="text-sm text-muted-foreground">
                    Este projeto pode ter sido excluido ou voce nao tem permissao para acessa-lo.
                </p>
                <Button variant="outline" onclick={() => goto('/projects')}>
                    Voltar para Projetos
                </Button>
            </div>
        {:else}
            <!-- Header with project info -->
            <div class="shrink-0 border-b border-border bg-muted/30 px-6 py-4">
                <div class="flex items-start justify-between">
                    <div class="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onclick={() => goto('/projects')}>
                            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                            </svg>
                        </Button>

                        <!-- Profile picture -->
                        <div class="h-16 w-16 overflow-hidden rounded-full border-2 border-border bg-muted">
                            {#if getProfilePicture()}
                                <img
                                    src={getProfilePicture()}
                                    alt={project.name}
                                    class="h-full w-full object-cover"
                                />
                            {:else}
                                <div class="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground">
                                    {project.name.charAt(0).toUpperCase()}
                                </div>
                            {/if}
                        </div>

                        <div>
                            <h1 class="text-xl font-semibold">{project.name}</h1>
                            {#if getHandle()}
                                <a
                                    href={project.instagramUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="text-sm text-muted-foreground hover:text-foreground hover:underline"
                                >
                                    @{getHandle()}
                                </a>
                            {/if}
                            <p class="text-sm text-muted-foreground">{postCount} {postCount === 1 ? 'post' : 'posts'}</p>
                        </div>
                    </div>

                    <div class="flex items-center gap-2">
                        <Button onclick={() => goto(`/posts/create?projectId=${projectId}`)}>
                            <svg class="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Criar Post
                        </Button>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Button variant={viewMode === "settings" ? "secondary" : "outline"} onclick={() => viewMode = viewMode === "gallery" ? "settings" : "gallery"}>
                                        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Configurações</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Button variant="outline" onclick={() => showDeleteConfirm = true}>
                                        <svg class="h-4 w-4 text-destructive" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                        </svg>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Excluir projeto</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
            </div>

            <!-- Main content -->
            <main class="flex-1 overflow-y-auto p-6">
                {#if viewMode === "settings"}
                    <div class="mx-auto max-w-2xl">
                        <ProjectSettingsForm {projectId} {project} />
                    </div>
                {:else if posts.length === 0}
                    <div class="flex flex-col items-center justify-center py-20">
                        <div class="flex h-20 w-20 items-center justify-center rounded-none border-2 border-dashed border-border bg-muted/50">
                            <svg class="h-10 w-10 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                            </svg>
                        </div>
                        <h3 class="mt-6 text-lg font-medium">Nenhum post ainda</h3>
                        <p class="mt-2 text-sm text-muted-foreground">
                            Crie seu primeiro post para este projeto
                        </p>
                        <Button class="mt-6" onclick={() => goto(`/posts/create?projectId=${projectId}`)}>
                            <svg class="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Criar Primeiro Post
                        </Button>
                    </div>
                {:else}
                    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {#each posts as post (post._id)}
                            <div
                                class="group relative flex flex-col overflow-hidden border border-border bg-card transition-shadow hover:shadow-lg cursor-pointer"
                                onclick={() => openLightbox(post._id)}
                                onkeydown={(e) => e.key === 'Enter' && openLightbox(post._id)}
                                role="button"
                                tabindex="0"
                            >
                                <!-- Image -->
                                <div class="relative aspect-square overflow-hidden bg-muted">
                                    {#if post.imageUrl}
                                        <img
                                            src={post.imageUrl}
                                            alt="Post gerado"
                                            class="h-full w-full object-cover transition-transform group-hover:scale-105"
                                        />
                                    {:else}
                                        <div class="flex h-full w-full items-center justify-center">
                                            <svg class="h-12 w-12 text-muted-foreground/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                            </svg>
                                        </div>
                                    {/if}

                                    <!-- Hover overlay with actions -->
                                    <div class="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                                        {#if post.imageUrl}
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <button
                                                            type="button"
                                                            aria-label="Baixar"
                                                            class="flex h-10 w-10 items-center justify-center bg-white/20 text-white backdrop-blur-sm hover:bg-white/30"
                                                            onclick={(e) => handleDownload(post.imageUrl!, e)}
                                                        >
                                                            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                                                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                                            </svg>
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Baixar</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        {/if}
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <button
                                                        type="button"
                                                        aria-label="Excluir"
                                                        class="flex h-10 w-10 items-center justify-center bg-white/20 text-white backdrop-blur-sm hover:bg-red-500/50"
                                                        onclick={(e) => handleDeletePost(post._id, e)}
                                                    >
                                                        <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                        </svg>
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Mover para lixeira</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>

                                    <!-- Model badge -->
                                    {#if post.imageModel}
                                        <div class="absolute bottom-2 left-2">
                                            <Badge variant="secondary" class="bg-black/60 text-white text-[10px] backdrop-blur-sm">
                                                {modelDisplayNames[post.imageModel] ?? post.imageModel.split("/").pop()}
                                            </Badge>
                                        </div>
                                    {/if}
                                </div>

                                <!-- Caption preview -->
                                <div class="flex flex-1 flex-col p-4">
                                    <p class="line-clamp-3 text-sm leading-relaxed">
                                        {truncateCaption(post.caption, 120)}
                                    </p>
                                    <div class="mt-auto pt-3">
                                        <span class="text-xs text-muted-foreground">
                                            {formatDate(post.createdAt)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </main>
        {/if}
    </SignedIn>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
    <!-- Backdrop -->
    <div
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onclick={() => showDeleteConfirm = false}
        onkeydown={(e) => e.key === "Enter" && (showDeleteConfirm = false)}
        role="button"
        tabindex="0"
    ></div>

    <!-- Modal -->
    <div class="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm border border-border bg-background shadow-xl p-6">
        <h3 class="text-lg font-semibold">Excluir projeto?</h3>
        <p class="mt-2 text-sm text-muted-foreground">
            Esta acao ira excluir o projeto e todos os {postCount} posts associados permanentemente. Esta acao nao pode ser desfeita.
        </p>
        <div class="mt-6 flex justify-end gap-3">
            <Button variant="outline" onclick={() => showDeleteConfirm = false} disabled={isDeleting}>
                Cancelar
            </Button>
            <Button variant="destructive" onclick={handleDelete} disabled={isDeleting}>
                {#if isDeleting}
                    <svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Excluindo...
                {:else}
                    Excluir
                {/if}
            </Button>
        </div>
    </div>
{/if}

<!-- Lightbox -->
{#if lightboxOpen && lightboxPostId && posts.length > 0}
    <Lightbox
        {posts}
        currentPostId={lightboxPostId}
        currentImageId={lightboxImageId}
        onclose={closeLightbox}
        onnavigate={navigateLightbox}
    />
{/if}
