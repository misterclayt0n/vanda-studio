<script lang="ts">
	import { Button, Badge, Textarea, Popover, PopoverTrigger, PopoverContent, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "$lib/components/ui";
	import { ImageModelSelector, AspectRatioSelector, ResolutionSelector, ProjectSelector } from "$lib/components/studio";
	import { SignedIn, SignedOut, SignInButton } from "svelte-clerk";
	import { useConvexClient, useQuery } from "convex-svelte";
	import { api } from "../../convex/_generated/api.js";
	import type { Id } from "../../convex/_generated/dataModel.js";
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import Navbar from "$lib/components/Navbar.svelte";
	import { MediaLightbox } from "$lib/components/lightbox";

	type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "21:9";
	type Resolution = "standard" | "high" | "ultra";

	const client = useConvexClient();

	// Generation form state
	let prompt = $state("");
	let selectedModels = $state<string[]>(["google/gemini-3-pro-image-preview"]);
	let aspectRatio = $state<AspectRatio>("1:1");
	let resolution = $state<Resolution>("standard");
	let selectedProjectId = $state<Id<"projects"> | null>(null);
	let isGenerating = $state(false);
	let error = $state<string | null>(null);

	// Upload state
	let fileInputEl = $state<HTMLInputElement | null>(null);
	let isUploading = $state(false);

	// Search state
	let searchQuery = $state("");

	// Project filter
	let filterProjectId = $state<Id<"projects"> | null>(null);
	let projectFilterOpen = $state(false);

	// Infinite scroll state
	type MediaItem = {
		_id: Id<"media_items">;
		_creationTime: number;
		url: string | null;
		model?: string;
		sourceType: string;
		prompt?: string;
		width: number;
		height: number;
		aspectRatio?: string;
		resolution?: string;
		createdAt: number;
		projectId?: Id<"projects">;
		storageId: Id<"_storage">;
		mimeType: string;
		deletedAt?: number;
	};
	let allItems = $state<MediaItem[]>([]);
	let cursor = $state<string | null>(null);
	let hasMore = $state(true);
	let loadingMore = $state(false);
	let initialLoadDone = $state(false);
	let sentinelEl = $state<HTMLDivElement | null>(null);

	// Active batch tracking
	let activeBatchId = $state<Id<"media_generation_batches"> | null>(null);

	// Lightbox state from URL params
	let initialProjectId = $derived($page.url.searchParams.get('projectId') as Id<"projects"> | null);
	let lightboxMediaId = $derived($page.url.searchParams.get('view'));
	let lightboxOpen = $derived(!!lightboxMediaId);

	function openLightbox(mediaId: string) {
		const url = new URL($page.url);
		url.searchParams.set('view', mediaId);
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function closeLightbox() {
		const url = new URL($page.url);
		url.searchParams.delete('view');
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function navigateLightbox(mediaId: string) {
		const url = new URL($page.url);
		url.searchParams.set('view', mediaId);
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	// Queries
	const projectsQuery = useQuery(api.projects.list, () => ({}));
	const initialItemsQuery = useQuery(
		api.mediaItems.listByUser,
		() => (filterProjectId || searchQuery.trim()) ? "skip" : { limit: 30 }
	);
	const projectItemsQuery = useQuery(
		api.mediaItems.listByProject,
		() => filterProjectId ? { projectId: filterProjectId } : "skip"
	);
	const searchResultsQuery = useQuery(
		api.mediaItems.search,
		() => searchQuery.trim() ? { query: searchQuery.trim(), limit: 20 } : "skip"
	);

	// Batch items for progressive loading
	const batchQuery = useQuery(
		api.mediaGenerationBatches.get,
		() => activeBatchId ? { id: activeBatchId } : "skip"
	);
	const batchItemsQuery = useQuery(
		api.mediaItems.listByBatch,
		() => activeBatchId ? { batchId: activeBatchId } : "skip"
	);

	// Project context
	const selectedProjectQuery = useQuery(
		api.projects.get,
		() => selectedProjectId ? { projectId: selectedProjectId } : "skip"
	);
	const contextImagesQuery = useQuery(
		api.contextImages.list,
		() => selectedProjectId ? { projectId: selectedProjectId } : "skip"
	);
	let selectedProject = $derived(selectedProjectQuery.data);
	let contextImages = $derived(contextImagesQuery.data ?? []);

	let projects = $derived(projectsQuery.data ?? []);
	let selectedFilterProject = $derived(projects.find(p => p._id === filterProjectId) ?? null);
	let batchData = $derived(batchQuery.data);
	let batchItems = $derived(batchItemsQuery.data ?? []);

	$effect(() => {
		if (initialProjectId && !selectedProjectId) {
			selectedProjectId = initialProjectId;
		}
	});

	// When batch completes, add its items to the grid and clear
	$effect(() => {
		if (batchData?.status === "completed" && batchItems.length > 0) {
			// Prepend new items
			const newIds = new Set(batchItems.map(i => i._id));
			allItems = [...batchItems as MediaItem[], ...allItems.filter(i => !newIds.has(i._id))];
			activeBatchId = null;
		}

		if (batchData?.status === "error") {
			error = "Não foi possível gerar imagens com os modelos selecionados. Tente novamente ou troque o modelo.";
			activeBatchId = null;
		}
	});

	// Initialize from initial query
	$effect(() => {
		if (initialItemsQuery.data && !filterProjectId && !searchQuery.trim() && !initialLoadDone) {
			allItems = initialItemsQuery.data.items as MediaItem[];
			cursor = initialItemsQuery.data.nextCursor;
			hasMore = initialItemsQuery.data.hasMore;
			initialLoadDone = true;
		}
	});

	// Load more (infinite scroll)
	async function loadMore() {
		if (loadingMore || !hasMore || filterProjectId || searchQuery.trim()) return;
		loadingMore = true;
		try {
			const args: { limit: number; cursor?: string } = { limit: 30 };
			if (cursor) args.cursor = cursor;
			const result = await client.query(api.mediaItems.listByUser, args);
			allItems = [...allItems, ...result.items as MediaItem[]];
			cursor = result.nextCursor;
			hasMore = result.hasMore;
		} catch (err) {
			console.error("Failed to load more:", err);
		} finally {
			loadingMore = false;
		}
	}

	// Reset when filters change
	$effect(() => {
		if (filterProjectId || searchQuery.trim()) {
			allItems = [];
			cursor = null;
			hasMore = true;
			initialLoadDone = false;
		}
	});

	// Intersection observer
	$effect(() => {
		if (!sentinelEl) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting && hasMore && !loadingMore && !filterProjectId && !searchQuery.trim()) {
					loadMore();
				}
			},
			{ rootMargin: "200px" }
		);
		observer.observe(sentinelEl);
		return () => observer.disconnect();
	});

	// Derived items
	let items = $derived(() => {
		if (searchQuery.trim()) return (searchResultsQuery.data ?? []) as MediaItem[];
		if (filterProjectId) return (projectItemsQuery.data ?? []) as MediaItem[];
		return allItems;
	});

	let isLoading = $derived(
		(initialItemsQuery.isLoading && !initialLoadDone) ||
		(filterProjectId && projectItemsQuery.isLoading) ||
		(searchQuery.trim() && searchResultsQuery.isLoading)
	);

	// Model display names
	const modelDisplayNames: Record<string, string> = {
		"google/gemini-2.5-flash-image": "Nano Banana",
		"google/gemini-3-pro-image-preview": "Nano Banana Pro",
		"bytedance-seed/seedream-4.5": "SeeDream v4.5",
		"black-forest-labs/flux.2-flex": "Flux 2 Flex",
		"openai/gpt-5-image": "GPT Image 1.5",
	};

	function formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleDateString('pt-BR', {
			day: '2-digit',
			month: 'short',
			year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
		});
	}

	// Source type labels
	function getSourceLabel(sourceType: string): string {
		switch (sourceType) {
			case 'generated': return 'Gerada';
			case 'uploaded': return 'Upload';
			case 'edited': return 'Editada';
			case 'imported': return 'Importada';
			default: return sourceType;
		}
	}

	function getSourceBadgeClass(sourceType: string): string {
		switch (sourceType) {
			case 'generated': return 'bg-purple-500/80 text-white';
			case 'uploaded': return 'bg-blue-500/80 text-white';
			case 'edited': return 'bg-green-500/80 text-white';
			default: return 'bg-gray-500/80 text-white';
		}
	}

	// Generate images
	async function handleGenerate() {
		if (!prompt.trim() || isGenerating) return;
		isGenerating = true;
		error = null;

		try {
			const contextImageUrls = contextImages
				.map((img) => img.url)
				.filter((url): url is string => !!url);
			const projectContext = selectedProject && selectedProjectId ? {
				...(selectedProject.accountDescription && { accountDescription: selectedProject.accountDescription }),
				...(selectedProject.brandTraits && { brandTraits: selectedProject.brandTraits }),
				...(selectedProject.additionalContext && { additionalContext: selectedProject.additionalContext }),
				...(contextImageUrls.length > 0 && { contextImageUrls }),
			} : undefined;

			const result = await client.action(api.ai.generateImages.generate, {
				...(selectedProjectId && { projectId: selectedProjectId }),
				message: prompt.trim(),
				imageModels: selectedModels,
				aspectRatio,
				resolution,
				...(projectContext && { projectContext }),
			});

			activeBatchId = result.batchId;
			prompt = "";
		} catch (err: any) {
			error = err.message ?? "Erro ao gerar imagens";
		} finally {
			isGenerating = false;
		}
	}

	// Upload image
	async function handleUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) return;

		isUploading = true;
		try {
			for (const file of Array.from(input.files)) {
				if (!file.type.startsWith('image/')) continue;

				// Get dimensions
				const dimensions = await getImageDimensions(file);

				// Upload to storage
				const uploadUrl = await client.mutation(api.referenceImages.generateUploadUrl, {});
				const uploadResult = await fetch(uploadUrl, {
					method: "POST",
					headers: { "Content-Type": file.type },
					body: file,
				});
				const { storageId } = await uploadResult.json();

				// Create media item
				await client.mutation(api.mediaItems.createUploaded, {
					storageId,
					mimeType: file.type,
					width: dimensions.width,
					height: dimensions.height,
					...(selectedProjectId && { projectId: selectedProjectId }),
				});
			}

			// Refresh
			initialLoadDone = false;
		} catch (err: any) {
			error = err.message ?? "Erro ao fazer upload";
		} finally {
			isUploading = false;
			input.value = "";
		}
	}

	function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				resolve({ width: img.width, height: img.height });
				URL.revokeObjectURL(img.src);
			};
			img.onerror = () => resolve({ width: 1024, height: 1024 });
			img.src = URL.createObjectURL(file);
		});
	}

	// Delete
	async function handleDelete(id: Id<"media_items">, event: Event) {
		event.stopPropagation();
		await client.mutation(api.mediaItems.softDelete, { id });
		allItems = allItems.filter(i => i._id !== id);
	}

	// Download
	async function handleDownload(url: string, event: Event) {
		event.stopPropagation();
		try {
			const response = await fetch(url);
			const blob = await response.blob();
			const blobUrl = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = blobUrl;
			link.download = `vanda-${Date.now()}.png`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(blobUrl);
		} catch (err) {
			console.error('Download failed:', err);
		}
	}

	function getProjectProfilePicture(project: typeof projects[0] | null): string | null {
		if (!project) return null;
		return project.profilePictureStorageUrl ?? project.profilePictureUrl ?? null;
	}

	function getProjectHandle(project: typeof projects[0]): string | null {
		if (project.instagramHandle) return project.instagramHandle;
		try {
			const url = new URL(project.instagramUrl);
			const parts = url.pathname.split('/').filter(Boolean);
			return parts[0] ?? null;
		} catch {
			return null;
		}
	}

	function selectProjectFilter(projectId: Id<"projects"> | null) {
		filterProjectId = projectId;
		projectFilterOpen = false;
	}
</script>

<svelte:head>
	<title>Imagens - Vanda Studio</title>
</svelte:head>

<div class="flex h-screen flex-col bg-background">
	<Navbar />

	<div class="flex flex-1 overflow-hidden">
		<!-- Left sidebar: Generation controls -->
		<aside class="flex w-80 shrink-0 flex-col border-r border-border bg-muted/20 overflow-y-auto">
			<div class="p-4 space-y-4">
				<h2 class="text-sm font-semibold text-foreground">Gerar Imagens</h2>

				<!-- Project selector -->
				<ProjectSelector value={selectedProjectId} onchange={(projectId) => (selectedProjectId = projectId)} />

				<!-- Prompt -->
				<div class="space-y-1.5">
					<p class="text-xs font-medium text-muted-foreground">Prompt</p>
					<Textarea
						placeholder="Descreva a imagem que deseja gerar..."
						bind:value={prompt}
						class="min-h-[100px] resize-none text-sm"
						onkeydown={(e) => {
							if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
								e.preventDefault();
								handleGenerate();
							}
						}}
					/>
				</div>

				<!-- Image Models -->
				<div class="space-y-1.5">
					<p class="text-xs font-medium text-muted-foreground">Modelos</p>
					<ImageModelSelector selected={selectedModels} onchange={(models) => (selectedModels = models)} />
				</div>

				<!-- Aspect Ratio -->
				<div class="space-y-1.5">
					<p class="text-xs font-medium text-muted-foreground">Proporção</p>
					<AspectRatioSelector value={aspectRatio} onchange={(value) => (aspectRatio = value)} />
				</div>

				<!-- Resolution -->
				<div class="space-y-1.5">
					<p class="text-xs font-medium text-muted-foreground">Resolução</p>
					<ResolutionSelector value={resolution} onchange={(value) => (resolution = value)} />
				</div>

				{#if error}
					<div class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
						{error}
					</div>
				{/if}

				<!-- Generate button -->
				<Button
					class="w-full"
					disabled={!prompt.trim() || isGenerating}
					onclick={handleGenerate}
				>
					{#if isGenerating}
						<svg class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Gerando...
					{:else}
						<svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
						</svg>
						Gerar
					{/if}
				</Button>

				<div class="border-t border-border pt-4">
					<input
						bind:this={fileInputEl}
						type="file"
						accept="image/*"
						multiple
						class="hidden"
						onchange={handleUpload}
					/>
					<Button
						variant="outline"
						class="w-full"
						disabled={isUploading}
						onclick={() => fileInputEl?.click()}
					>
						{#if isUploading}
							Enviando...
						{:else}
							<svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
							</svg>
							Upload
						{/if}
					</Button>
				</div>
			</div>
		</aside>

		<!-- Main area: Image grid -->
		<main class="flex flex-1 flex-col overflow-hidden">
			<!-- Sub-header -->
			<div class="shrink-0 border-b border-border bg-muted/30 px-4 py-3">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-4">
						<!-- Search -->
						<div class="relative">
							<input
								type="text"
								placeholder="Buscar..."
								class="flex h-9 w-72 rounded-md border border-input bg-transparent px-3 py-1 pl-9 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
								value={searchQuery}
								oninput={(e) => searchQuery = (e.target as HTMLInputElement).value}
							/>
							<svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
							</svg>
							{#if searchQuery}
								<button
									type="button"
									aria-label="Limpar busca"
									class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
									onclick={() => searchQuery = ""}
								>
									<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							{/if}
						</div>

						<!-- Project Filter -->
						{#if projects.length > 0}
							<Popover bind:open={projectFilterOpen}>
								<PopoverTrigger>
									<button
										type="button"
										class="flex h-9 items-center gap-2 border border-border bg-background px-3 text-sm transition-colors hover:bg-muted"
									>
										{#if selectedFilterProject}
											<span>{selectedFilterProject.name}</span>
										{:else}
											<svg class="h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
											</svg>
											<span class="text-muted-foreground">Filtrar projeto</span>
										{/if}
										<svg class="h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
										</svg>
									</button>
								</PopoverTrigger>
								<PopoverContent class="w-56 p-1" align="start">
									<button
										type="button"
										class="flex w-full items-center gap-2 px-2 py-2 text-sm hover:bg-muted {filterProjectId === null ? 'bg-muted' : ''}"
										onclick={() => selectProjectFilter(null)}
									>
										<span>Todos os projetos</span>
									</button>
									<div class="my-1 border-t border-border"></div>
									{#each projects as project (project._id)}
										<button
											type="button"
											class="flex w-full items-center gap-2 px-2 py-2 text-sm hover:bg-muted {filterProjectId === project._id ? 'bg-muted' : ''}"
											onclick={() => selectProjectFilter(project._id)}
										>
											<span>{project.name}</span>
										</button>
									{/each}
								</PopoverContent>
							</Popover>
						{/if}

						<span class="text-sm text-muted-foreground">
							{items().length} imagem{items().length !== 1 ? 'ns' : ''}
						</span>
					</div>
				</div>
			</div>

			<!-- Grid -->
			<div class="flex-1 overflow-y-auto p-6">
				<SignedOut>
					<div class="flex flex-1 flex-col items-center justify-center gap-6 py-20">
						<h2 class="text-2xl font-bold">Entre para ver suas imagens</h2>
						<SignInButton mode="modal">
							<button class="h-9 rounded-none bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
								Entrar
							</button>
						</SignInButton>
					</div>
				</SignedOut>

				<SignedIn>
					<!-- Batch skeleton cards -->
					{#if activeBatchId && batchData?.status === "generating"}
						<div class="mb-4">
							<div class="mb-2 flex items-center gap-2">
								<svg class="h-4 w-4 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								<span class="text-sm text-muted-foreground">
									Gerando {batchData.totalModels - (batchData.pendingModels?.length ?? 0)}/{batchData.totalModels}...
								</span>
							</div>
							<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
								{#each batchItems as item (item._id)}
									<div
										class="group relative flex flex-col overflow-hidden border border-border bg-card cursor-pointer"
										onclick={() => openLightbox(item._id)}
										onkeydown={(e) => e.key === 'Enter' && openLightbox(item._id)}
										role="button"
										tabindex="0"
									>
										<div class="relative aspect-square overflow-hidden bg-muted">
											{#if item.url}
												<img src={item.url} alt="Imagem gerada" class="h-full w-full object-cover" />
											{/if}
										</div>
									</div>
								{/each}
								{#each (batchData.pendingModels ?? []) as model (model)}
									<div class="flex flex-col overflow-hidden border border-border bg-card">
										<div class="relative aspect-square overflow-hidden bg-muted animate-pulse">
											<div class="flex h-full w-full items-center justify-center">
												<span class="text-xs text-muted-foreground">{modelDisplayNames[model] ?? model.split("/").pop()}</span>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					{#if isLoading}
						<div class="flex items-center justify-center py-20">
							<svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
						</div>
					{:else if items().length === 0 && !activeBatchId}
						<div class="flex flex-col items-center justify-center py-20">
							<div class="flex h-20 w-20 items-center justify-center rounded-none border-2 border-dashed border-border bg-muted/50">
								<svg class="h-10 w-10 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
								</svg>
							</div>
							<h3 class="mt-6 text-lg font-medium">
								{#if searchQuery.trim()}
									Nenhum resultado encontrado
								{:else}
									Nenhuma imagem ainda
								{/if}
							</h3>
							<p class="mt-2 text-sm text-muted-foreground">
								{#if searchQuery.trim()}
									Tente buscar por outros termos
								{:else}
									Use o painel lateral para gerar ou fazer upload de imagens
								{/if}
							</p>
						</div>
					{:else}
						<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{#each items() as item (item._id)}
								<div
									class="group relative flex flex-col overflow-hidden border border-border bg-card transition-shadow hover:shadow-lg cursor-pointer"
									onclick={() => openLightbox(item._id)}
									onkeydown={(e) => e.key === 'Enter' && openLightbox(item._id)}
									role="button"
									tabindex="0"
								>
									<div class="relative aspect-square overflow-hidden bg-muted">
										{#if item.url}
											<img
												src={item.url}
												alt="Imagem"
												class="h-full w-full object-cover transition-transform group-hover:scale-105"
											/>
										{:else}
											<div class="flex h-full w-full items-center justify-center">
												<svg class="h-12 w-12 text-muted-foreground/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
												</svg>
											</div>
										{/if}

										<!-- Hover overlay -->
										<div class="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
											{#if item.url}
												<TooltipProvider>
													<Tooltip>
														<TooltipTrigger>
															<button
																type="button"
																aria-label="Baixar"
																class="flex h-10 w-10 items-center justify-center bg-white/20 text-white backdrop-blur-sm hover:bg-white/30"
																onclick={(e) => handleDownload(item.url!, e)}
															>
																<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
																	<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
																</svg>
															</button>
														</TooltipTrigger>
														<TooltipContent><p>Baixar</p></TooltipContent>
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
															onclick={(e) => handleDelete(item._id, e)}
														>
															<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
																<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
															</svg>
														</button>
													</TooltipTrigger>
													<TooltipContent><p>Excluir</p></TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</div>

										<!-- Model badge -->
										{#if item.model}
											<div class="absolute bottom-2 left-2">
												<Badge variant="secondary" class="bg-black/60 text-white text-[10px] backdrop-blur-sm">
													{modelDisplayNames[item.model] ?? item.model.split("/").pop()}
												</Badge>
											</div>
										{/if}

										<!-- Source type badge -->
										{#if item.sourceType !== "generated"}
											<div class="absolute top-2 right-2">
												<Badge variant="secondary" class="{getSourceBadgeClass(item.sourceType)} text-[10px] backdrop-blur-sm">
													{getSourceLabel(item.sourceType)}
												</Badge>
											</div>
										{/if}
									</div>

									<!-- Date -->
									<div class="p-3">
										<span class="text-xs text-muted-foreground">
											{formatDate(item.createdAt)}
										</span>
										{#if item.prompt}
											<p class="mt-1 line-clamp-2 text-xs text-muted-foreground/80">
												{item.prompt.length > 80 ? item.prompt.substring(0, 80) + '...' : item.prompt}
											</p>
										{/if}
									</div>
								</div>
							{/each}
						</div>

						<!-- Infinite scroll sentinel -->
						{#if !filterProjectId && !searchQuery.trim()}
							<div bind:this={sentinelEl} class="h-1" aria-hidden="true"></div>
							{#if loadingMore}
								<div class="flex items-center justify-center py-8">
									<svg class="h-6 w-6 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
								</div>
							{:else if !hasMore && allItems.length > 0}
								<div class="flex items-center justify-center py-8">
									<span class="text-sm text-muted-foreground">Todas as imagens foram carregadas</span>
								</div>
							{/if}
						{/if}
					{/if}
				</SignedIn>
			</div>
		</main>
	</div>
</div>

<!-- Media Lightbox -->
{#if lightboxOpen && lightboxMediaId && items().length > 0}
	<MediaLightbox
		items={items()}
		currentMediaId={lightboxMediaId}
		onclose={closeLightbox}
		onnavigate={navigateLightbox}
	/>
{/if}
