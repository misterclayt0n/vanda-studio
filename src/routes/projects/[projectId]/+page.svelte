<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import { MediaLightbox, Lightbox } from "$lib/components/lightbox";
	import Navbar from "$lib/components/Navbar.svelte";
	import { ProjectSettingsForm } from "$lib/components/projects";
	import { Badge, Button } from "$lib/components/ui";
	import { api } from "../../../convex/_generated/api.js";
	import type { Id } from "../../../convex/_generated/dataModel.js";
	import { useConvexClient, useQuery } from "convex-svelte";
	import { SignedIn, SignedOut, SignInButton } from "svelte-clerk";

	type ProjectTab = "images" | "posts" | "settings";

	type MediaItem = {
		_id: Id<"media_items">;
		url: string | null;
		storageId: Id<"_storage">;
		mimeType: string;
		model?: string;
		prompt?: string;
		sourceType: string;
		width: number;
		height: number;
		aspectRatio?: string;
		resolution?: string;
		createdAt: number;
	};

	type ProjectPost = {
		_id: Id<"generated_posts">;
		caption: string;
		imageUrl: string | null;
		imageModel?: string;
		createdAt: number;
		isComposed?: boolean;
	};

	const client = useConvexClient();

	const modelDisplayNames: Record<string, string> = {
		"google/gemini-2.5-flash-image": "Nano Banana",
		"google/gemini-3-pro-image-preview": "Nano Banana Pro",
		"bytedance-seed/seedream-4.5": "SeeDream v4.5",
		"black-forest-labs/flux.2-flex": "Flux 2 Flex",
		"openai/gpt-5-image": "GPT Image 1.5",
	};

	const sourceLabels: Record<string, string> = {
		generated: "Gerada",
		uploaded: "Upload",
		edited: "Editada",
		imported: "Importada",
	};

	let projectId = $derived($page.params.projectId as Id<"projects">);
	let activeTab = $derived(($page.url.searchParams.get("tab") as ProjectTab | null) ?? "images");
	let lightboxPostId = $derived($page.url.searchParams.get("post"));
	let lightboxImageId = $derived($page.url.searchParams.get("img"));
	let lightboxMediaId = $derived($page.url.searchParams.get("media"));
	let showDeleteConfirm = $state(false);
	let isDeletingProject = $state(false);

	const projectQuery = useQuery(api.projects.get, () => ({ projectId }));
	const postsQuery = useQuery(api.generatedPosts.listByProject, () => ({ projectId }));
	const mediaQuery = useQuery(api.mediaItems.listCardsByProject, () => ({ projectId }));

	let project = $derived(projectQuery.data);
	let posts = $derived((postsQuery.data ?? []) as ProjectPost[]);
	let mediaItems = $derived((mediaQuery.data ?? []) as MediaItem[]);
	let legacyPosts = $derived(posts.filter((post) => !post.isComposed));
	let isLoading = $derived(projectQuery.isLoading);

	function setTab(tab: ProjectTab) {
		const url = new URL($page.url);
		url.searchParams.set("tab", tab);
		url.searchParams.delete("post");
		url.searchParams.delete("img");
		url.searchParams.delete("media");
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function openLegacyPost(postId: string, imageId?: string | null) {
		const url = new URL($page.url);
		url.searchParams.set("tab", "posts");
		url.searchParams.set("post", postId);
		if (imageId) {
			url.searchParams.set("img", imageId);
		} else {
			url.searchParams.delete("img");
		}
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function closeLegacyPost() {
		const url = new URL($page.url);
		url.searchParams.delete("post");
		url.searchParams.delete("img");
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function openMedia(mediaId: string) {
		const url = new URL($page.url);
		url.searchParams.set("tab", "images");
		url.searchParams.set("media", mediaId);
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function closeMedia() {
		const url = new URL($page.url);
		url.searchParams.delete("media");
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function navigateMedia(mediaId: string) {
		const url = new URL($page.url);
		url.searchParams.set("media", mediaId);
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function getProfilePicture(): string | null {
		if (!project) return null;
		return project.profilePictureStorageUrl ?? project.profilePictureUrl ?? null;
	}

	function getHandle(): string | null {
		if (!project) return null;
		if (project.instagramHandle) return project.instagramHandle;
		try {
			const url = new URL(project.instagramUrl);
			const parts = url.pathname.split("/").filter(Boolean);
			return parts[0] ?? null;
		} catch {
			return null;
		}
	}

	function formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleDateString("pt-BR", {
			day: "2-digit",
			month: "short",
			year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
		});
	}

	function truncateCaption(caption: string, maxLength = 140) {
		if (caption.length <= maxLength) return caption;
		return `${caption.slice(0, maxLength).trim()}...`;
	}

	async function handleDeleteProject() {
		isDeletingProject = true;
		try {
			await client.mutation(api.projects.remove, { projectId });
			goto("/projects");
		} catch (err) {
			console.error("Failed to delete project:", err);
		} finally {
			isDeletingProject = false;
		}
	}

	async function handleDeletePost(postId: Id<"generated_posts">, event: Event) {
		event.stopPropagation();
		await client.mutation(api.generatedPosts.softDelete, { id: postId });
	}

	async function handleDeleteMedia(mediaId: Id<"media_items">, event: Event) {
		event.stopPropagation();
		await client.mutation(api.mediaItems.softDelete, { id: mediaId });
	}
</script>

<svelte:head>
	<title>{project?.name ?? "Projeto"} - Vanda Studio</title>
</svelte:head>

<div class="flex h-screen flex-col bg-background">
	<Navbar />

	<SignedOut>
		<div class="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-20">
			<div class="max-w-md text-center">
				<h2 class="text-2xl font-semibold">Entre para ver este projeto</h2>
				<p class="mt-2 text-sm text-muted-foreground">
					Faça login para acessar imagens, posts e configuracoes do projeto.
				</p>
			</div>
			<SignInButton mode="modal">
				<button class="h-10 rounded-none bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
					Entrar
				</button>
			</SignInButton>
		</div>
	</SignedOut>

	<SignedIn>
		{#if isLoading}
			<div class="flex flex-1 items-center justify-center">
				<svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
			</div>
		{:else if !project}
			<div class="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
				<h3 class="text-lg font-medium">Projeto não encontrado</h3>
				<p class="max-w-md text-sm text-muted-foreground">
					Este projeto pode ter sido removido ou você não tem permissão para acessá-lo.
				</p>
				<Button variant="outline" onclick={() => goto("/projects")}>Voltar para projetos</Button>
			</div>
		{:else}
			<div class="border-b border-border bg-muted/20 px-6 py-5">
				<div class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
					<div class="flex items-start gap-4">
						<Button variant="ghost" size="sm" onclick={() => goto("/projects")}>
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
							</svg>
						</Button>

						<div class="h-16 w-16 overflow-hidden rounded-full border border-border bg-muted">
							{#if getProfilePicture()}
								<img src={getProfilePicture()} alt={project.name} class="h-full w-full object-cover" />
							{:else}
								<div class="flex h-full w-full items-center justify-center text-xl font-semibold text-muted-foreground">
									{project.name.charAt(0).toUpperCase()}
								</div>
							{/if}
						</div>

						<div class="space-y-2">
							<div class="flex flex-wrap items-center gap-3">
								<h1 class="text-2xl font-semibold">{project.name}</h1>
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
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<Badge variant={activeTab === "images" ? "default" : "outline"}>
									{mediaItems.length} imagem{mediaItems.length !== 1 ? "ns" : ""}
								</Badge>
								<Badge variant={activeTab === "posts" ? "default" : "outline"}>
									{posts.length} post{posts.length !== 1 ? "s" : ""}
								</Badge>
							</div>
						</div>
					</div>

					<div class="flex flex-wrap items-center gap-2">
						<Button variant="outline" onclick={() => goto(`/images?projectId=${projectId}`)}>
							Nova imagem
						</Button>
						<Button onclick={() => goto(`/posts/create?projectId=${projectId}`)}>
							Novo post
						</Button>
						<Button variant="outline" onclick={() => setTab("settings")}>
							Configuracoes
						</Button>
						<Button variant="outline" class="text-destructive hover:text-destructive" onclick={() => (showDeleteConfirm = true)}>
							Excluir projeto
						</Button>
					</div>
				</div>

				<div class="mt-6 flex flex-wrap items-center gap-2">
					<Button variant={activeTab === "images" ? "secondary" : "ghost"} onclick={() => setTab("images")}>
						Imagens
					</Button>
					<Button variant={activeTab === "posts" ? "secondary" : "ghost"} onclick={() => setTab("posts")}>
						Posts
					</Button>
					<Button variant={activeTab === "settings" ? "secondary" : "ghost"} onclick={() => setTab("settings")}>
						Settings
					</Button>
				</div>
			</div>

			<main class="flex-1 overflow-y-auto px-6 py-6">
				{#if activeTab === "settings"}
					<div class="mx-auto max-w-2xl">
						<ProjectSettingsForm {projectId} {project} />
					</div>
				{:else if activeTab === "images"}
					{#if mediaItems.length === 0}
						<div class="flex flex-col items-center justify-center border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
							<h3 class="text-lg font-medium">Nenhuma imagem ainda</h3>
							<p class="mt-2 max-w-md text-sm text-muted-foreground">
								Gere imagens novas ou envie assets para começar a biblioteca visual deste projeto.
							</p>
							<Button class="mt-4" onclick={() => goto(`/images?projectId=${projectId}`)}>
								Abrir workspace de imagens
							</Button>
						</div>
					{:else}
						<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{#each mediaItems as item (item._id)}
								<div
									class="group cursor-pointer overflow-hidden border border-border bg-card"
									role="button"
									tabindex="0"
									onclick={() => openMedia(item._id)}
									onkeydown={(event) => event.key === "Enter" && openMedia(item._id)}
								>
									<div class="relative aspect-square overflow-hidden bg-muted">
										{#if item.url}
											<img src={item.url} alt="" class="h-full w-full object-cover transition-transform group-hover:scale-105" />
										{/if}
										<div class="absolute left-3 top-3 flex items-center gap-2">
											<Badge variant="secondary">{sourceLabels[item.sourceType] ?? item.sourceType}</Badge>
										</div>
										<button
											type="button"
											aria-label="Mover imagem para lixeira"
											class="absolute right-3 top-3 flex h-9 w-9 items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
											onclick={(event) => handleDeleteMedia(item._id, event)}
										>
											<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
											</svg>
										</button>
									</div>
									<div class="space-y-2 p-4">
										<div class="flex items-center justify-between gap-2">
											<span class="text-sm font-medium">
												{item.model ? modelDisplayNames[item.model] ?? item.model.split("/").pop() : "Biblioteca"}
											</span>
											<span class="text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
										</div>
										{#if item.prompt}
											<p class="line-clamp-2 text-sm text-muted-foreground">{item.prompt}</p>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				{:else}
					{#if posts.length === 0}
						<div class="flex flex-col items-center justify-center border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
							<h3 class="text-lg font-medium">Nenhum post ainda</h3>
							<p class="mt-2 max-w-md text-sm text-muted-foreground">
								Monte um novo post com imagens da biblioteca ou abra um draft existente.
							</p>
							<Button class="mt-4" onclick={() => goto(`/posts/create?projectId=${projectId}`)}>
								Criar post
							</Button>
						</div>
					{:else}
						<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{#each posts as post (post._id)}
								<div
									class="group cursor-pointer overflow-hidden border border-border bg-card"
									role="button"
									tabindex="0"
									onclick={() => (post.isComposed ? goto(`/posts/create?postId=${post._id}`) : openLegacyPost(post._id))}
									onkeydown={(event) => event.key === "Enter" && (post.isComposed ? goto(`/posts/create?postId=${post._id}`) : openLegacyPost(post._id))}
								>
									<div class="relative aspect-square overflow-hidden bg-muted">
										{#if post.imageUrl}
											<img src={post.imageUrl} alt="" class="h-full w-full object-cover transition-transform group-hover:scale-105" />
										{/if}
										<div class="absolute left-3 top-3 flex items-center gap-2">
											<Badge>{post.isComposed ? "Composto" : "Gerado"}</Badge>
											{#if post.imageModel}
												<Badge variant="secondary">{modelDisplayNames[post.imageModel] ?? post.imageModel.split("/").pop()}</Badge>
											{/if}
										</div>
										<button
											type="button"
											aria-label="Mover post para lixeira"
											class="absolute right-3 top-3 flex h-9 w-9 items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
											onclick={(event) => handleDeletePost(post._id, event)}
										>
											<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
											</svg>
										</button>
									</div>
									<div class="space-y-2 p-4">
										<p class="line-clamp-3 text-sm leading-relaxed">{truncateCaption(post.caption)}</p>
										<div class="flex items-center justify-between gap-2 text-xs text-muted-foreground">
											<span>{formatDate(post.createdAt)}</span>
											<span>{post.isComposed ? "Abrir editor" : "Abrir preview"}</span>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				{/if}
			</main>
		{/if}
	</SignedIn>
</div>

{#if lightboxMediaId && mediaItems.length > 0}
	<MediaLightbox
		items={mediaItems}
		currentMediaId={lightboxMediaId}
		onclose={closeMedia}
		onnavigate={navigateMedia}
	/>
{/if}

{#if lightboxPostId && legacyPosts.length > 0}
	<Lightbox
		posts={legacyPosts}
		currentPostId={lightboxPostId}
		currentImageId={lightboxImageId}
		onclose={closeLegacyPost}
		onnavigate={openLegacyPost}
	/>
{/if}

{#if showDeleteConfirm}
	<div
		class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
		onclick={() => (showDeleteConfirm = false)}
		onkeydown={(event) => event.key === "Enter" && (showDeleteConfirm = false)}
		role="button"
		tabindex="0"
	></div>

	<div class="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 border border-border bg-background p-6 shadow-xl">
		<h3 class="text-lg font-semibold">Excluir projeto?</h3>
		<p class="mt-2 text-sm text-muted-foreground">
			Isso remove o projeto e os dados associados. Use com cuidado.
		</p>
		<div class="mt-6 flex justify-end gap-3">
			<Button variant="outline" onclick={() => (showDeleteConfirm = false)} disabled={isDeletingProject}>
				Cancelar
			</Button>
			<Button variant="destructive" onclick={handleDeleteProject} disabled={isDeletingProject}>
				{isDeletingProject ? "Excluindo..." : "Excluir"}
			</Button>
		</div>
	</div>
{/if}
