<script lang="ts">
	import {
		Button,
		Badge,
		Textarea,
		Popover,
		PopoverTrigger,
		PopoverContent,
	} from "$lib/components/ui";
	import {
		ImageModelSelector,
		AspectRatioSelector,
		ResolutionSelector,
		ProjectSelector,
		ImageSkeleton,
	} from "$lib/components/studio";
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

	type MediaItem = {
		_id: Id<"media_items">;
		_creationTime: number;
		url: string | null;
		thumbnailUrl?: string | null;
		model?: string;
		sourceType: string;
		prompt?: string;
		userPrompt?: string;
		generationDurationMs?: number;
		width: number;
		height: number;
		aspectRatio?: string;
		resolution?: string;
		createdAt: number;
		projectId?: Id<"projects">;
		batchId?: Id<"media_generation_batches">;
		storageId: Id<"_storage">;
		mimeType: string;
		deletedAt?: number;
	};

	type GridCard =
		| { type: "item"; key: string; item: MediaItem }
		| { type: "pending"; key: string; model: string; aspectRatio?: string }
		| {
			type: "conversationPending";
			key: string;
			model: string;
			aspectRatio?: string;
			title: string;
			conversationId: Id<"image_edit_conversations">;
			updatedAt: number;
		};

	type ViewMode = "images" | "conversations";

	type ConversationOutput = {
		_id: Id<"image_edit_outputs">;
		url: string | null;
		thumbnailUrl?: string | null;
		model: string;
		width: number;
		height: number;
		createdAt: number;
	};

	type ConversationTurn = {
		_id: Id<"image_edit_turns">;
		userMessage: string;
		selectedModels: string[];
		aspectRatio: string;
		resolution: string;
		status: string;
		pendingModels?: string[];
		outputs: ConversationOutput[];
		createdAt: number;
	};

	type ConversationSummary = {
		_id: Id<"image_edit_conversations">;
		title: string;
		createdAt: number;
		updatedAt: number;
		turnCount: number;
		sourceImageUrl?: string | null;
		thumbnailUrl?: string | null;
		latestOutputUrl?: string | null;
		latestTurn: ConversationTurn | null;
	};

	type PendingConversationSummary = {
		_id: Id<"image_edit_conversations">;
		title: string;
		updatedAt: number;
		latestTurn: {
			_id: Id<"image_edit_turns">;
			userMessage: string;
			aspectRatio: string;
			resolution: string;
			status: string;
			pendingModels: string[];
		} | null;
	};

	const client = useConvexClient();
	const ACTIVE_GENERATION_WINDOW_MS = 5 * 60 * 1000;

	const modelDisplayNames: Record<string, string> = {
		"google/gemini-2.5-flash-image": "Nano Banana",
		"google/gemini-3-pro-image-preview": "Nano Banana Pro",
		"bytedance-seed/seedream-4.5": "SeeDream v4.5",
		"black-forest-labs/flux.2-flex": "Flux 2 Flex",
		"openai/gpt-5-image": "GPT Image 1.5",
	};

	let prompt = $state("");
	let selectedModels = $state<string[]>(["google/gemini-3-pro-image-preview"]);
	let aspectRatio = $state<AspectRatio>("1:1");
	let resolution = $state<Resolution>("standard");
	let selectedProjectId = $state<Id<"projects"> | null>(null);
	let isGenerating = $state(false);
	let error = $state<string | null>(null);

	let fileInputEl = $state<HTMLInputElement | null>(null);
	let isUploading = $state(false);

	let searchQuery = $state("");
	let filterProjectId = $state<Id<"projects"> | null>(null);
	let projectFilterOpen = $state(false);
	let viewMode = $state<ViewMode>(
		(($page.url.searchParams.get("tab") as ViewMode | null) === "conversations")
			? "conversations"
			: "images"
	);

	let allItems = $state<MediaItem[]>([]);
	let cursor = $state<string | null>(null);
	let hasMore = $state(true);
	let loadingMore = $state(false);
	let initialLoadDone = $state(false);
	let sentinelEl = $state<HTMLDivElement | null>(null);
	let activeBatchId = $state<Id<"media_generation_batches"> | null>(null);
	let staleCleanupStarted = $state(false);
	let requestedThumbnailIds = $state<string[]>([]);

	let initialProjectId = $derived($page.url.searchParams.get("projectId") as Id<"projects"> | null);
	let lightboxMediaId = $derived($page.url.searchParams.get("view"));
	let lightboxOpen = $derived(!!lightboxMediaId);

	function openLightbox(mediaId: string) {
		const url = new URL($page.url);
		url.searchParams.set("view", mediaId);
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function closeLightbox() {
		const url = new URL($page.url);
		url.searchParams.delete("view");
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function navigateLightbox(mediaId: string) {
		const url = new URL($page.url);
		url.searchParams.set("view", mediaId);
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function setViewMode(mode: ViewMode) {
		viewMode = mode;
		const url = new URL($page.url);
		if (mode === "images") {
			url.searchParams.delete("tab");
		} else {
			url.searchParams.set("tab", mode);
			url.searchParams.delete("view");
		}
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	const projectsQuery = useQuery(api.projects.list, () => ({}));
	const initialItemsQuery = useQuery(
		api.mediaItems.listCardsByUser,
		() => (filterProjectId || searchQuery.trim()) ? "skip" : { limit: 30 }
	);
	const projectItemsQuery = useQuery(
		api.mediaItems.listCardsByProject,
		() => filterProjectId ? { projectId: filterProjectId } : "skip"
	);
	const searchResultsQuery = useQuery(
		api.mediaItems.searchCards,
		() => searchQuery.trim() ? { query: searchQuery.trim(), limit: 20 } : "skip"
	);
	const conversationsQuery = useQuery(
		api.imageEditConversations.listByUser,
		() => viewMode === "conversations" ? {} : "skip"
	);
	const pendingConversationsQuery = useQuery(
		api.imageEditConversations.listPendingByUser,
		() => viewMode === "images"
			? { limit: 12, staleAfterMs: ACTIVE_GENERATION_WINDOW_MS }
			: "skip"
	);
	const recentBatchesQuery = useQuery(api.mediaGenerationBatches.listByUser, () => ({ limit: 6 }));
	const batchQuery = useQuery(
		api.mediaGenerationBatches.get,
		() => activeBatchId ? { id: activeBatchId } : "skip"
	);
	const batchItemsQuery = useQuery(
		api.mediaItems.listByBatch,
		() => activeBatchId ? { batchId: activeBatchId } : "skip"
	);
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
	let recentBatches = $derived(recentBatchesQuery.data ?? []);
	let selectedFilterProject = $derived(projects.find((project) => project._id === filterProjectId) ?? null);
	let batchData = $derived(batchQuery.data);
	let batchItems = $derived(batchItemsQuery.data ?? []);
	let showGeneratingBatchCards = $derived(
		!!activeBatchId &&
		!!batchData &&
		batchData.status === "generating" &&
		Date.now() - batchLastProgressAt(batchData) < ACTIVE_GENERATION_WINDOW_MS &&
		!searchQuery.trim() &&
		(!filterProjectId || batchData.projectId === filterProjectId)
	);

	$effect(() => {
		if (initialProjectId && !selectedProjectId) {
			selectedProjectId = initialProjectId;
		}
	});

	$effect(() => {
		const nextMode =
			($page.url.searchParams.get("tab") as ViewMode | null) === "conversations"
				? "conversations"
				: "images";
		if (nextMode !== viewMode) {
			viewMode = nextMode;
		}
	});

	$effect(() => {
		if (activeBatchId || recentBatches.length === 0) return;
		const candidate = recentBatches.find((batch) => batch.status === "generating");
		if (candidate && Date.now() - (batchLastProgressAt(candidate) ?? candidate.createdAt) < ACTIVE_GENERATION_WINDOW_MS) {
			activeBatchId = candidate._id;
		}
	});

	$effect(() => {
		if (viewMode !== "images" || staleCleanupStarted) return;
		staleCleanupStarted = true;

		void Promise.allSettled([
			client.mutation(api.imageEditConversations.cleanupStalePendingByUser, {
				staleAfterMs: ACTIVE_GENERATION_WINDOW_MS,
			}),
			client.mutation(api.mediaGenerationBatches.cleanupStaleByUser, {
				staleAfterMs: ACTIVE_GENERATION_WINDOW_MS,
			}),
		]);
	});

	$effect(() => {
		if ((batchData?.status === "completed" || batchData?.status === "generating") && batchItems.length > 0) {
			const newIds = new Set(batchItems.map((item) => item._id));
			const merged = [...(batchItems as MediaItem[]), ...allItems.filter((item) => !newIds.has(item._id))];
			const sameOrder =
				allItems.length === merged.length &&
				allItems.every((item, index) => item._id === merged[index]?._id);
			if (!sameOrder) {
				allItems = merged;
			}
		}

		if (batchData?.status === "completed") {
			activeBatchId = null;
		}

		if (
			batchData?.status === "generating" &&
			Date.now() - batchLastProgressAt(batchData) >= ACTIVE_GENERATION_WINDOW_MS
		) {
			activeBatchId = null;
		}

		if (batchData?.status === "error") {
			error = "Não foi possível gerar imagens com os modelos selecionados. Tente novamente ou troque o modelo.";
			activeBatchId = null;
		}
	});

	$effect(() => {
		if (!initialItemsQuery.data || filterProjectId || searchQuery.trim()) return;

		const nextItems = initialItemsQuery.data.items as MediaItem[];
		const nextIds = new Set(nextItems.map((item) => item._id));
		const merged = [...nextItems, ...allItems.filter((item) => !nextIds.has(item._id))];
		const sameOrder =
			allItems.length === merged.length &&
			allItems.every((item, index) => item._id === merged[index]?._id);

		if (!sameOrder) {
			allItems = merged;
		}

		cursor = initialItemsQuery.data.nextCursor;
		hasMore = initialItemsQuery.data.hasMore;
		if (!initialLoadDone) {
			initialLoadDone = true;
		}
	});

	async function loadMore() {
		if (loadingMore || !hasMore || filterProjectId || searchQuery.trim()) return;
		loadingMore = true;
		try {
			const args: { limit: number; cursor?: string } = { limit: 30 };
			if (cursor) args.cursor = cursor;
			const result = await client.query(api.mediaItems.listCardsByUser, args);
			allItems = [...allItems, ...(result.items as MediaItem[])];
			cursor = result.nextCursor;
			hasMore = result.hasMore;
		} catch (err) {
			console.error("Failed to load more:", err);
		} finally {
			loadingMore = false;
		}
	}

	$effect(() => {
		if (filterProjectId || searchQuery.trim()) {
			allItems = [];
			cursor = null;
			hasMore = true;
			initialLoadDone = false;
		}
	});

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

	$effect(() => {
		if (viewMode !== "images") return;

		const idsToEnsure = items()
			.filter((item) => item.url && !item.thumbnailUrl)
			.map((item) => item._id)
			.filter((id) => !requestedThumbnailIds.includes(id))
			.slice(0, 24);

		if (idsToEnsure.length === 0) return;

		requestedThumbnailIds = [...requestedThumbnailIds, ...idsToEnsure];
		void client.mutation(api.mediaItems.ensureThumbnails, { ids: idsToEnsure }).catch((err) => {
			console.error("Failed to queue thumbnails:", err);
		});
	});

	let items = $derived(() => {
		if (searchQuery.trim()) return (searchResultsQuery.data ?? []) as MediaItem[];
		if (filterProjectId) return (projectItemsQuery.data ?? []) as MediaItem[];
		return allItems;
	});
	let conversations = $derived((conversationsQuery.data ?? []) as ConversationSummary[]);
	let pendingConversations = $derived((pendingConversationsQuery.data ?? []) as PendingConversationSummary[]);
	let conversationPendingCards = $derived(() => {
		if (searchQuery.trim() || filterProjectId) return [] as GridCard[];

		return pendingConversations
			.filter((conversation) => (conversation.latestTurn?.pendingModels?.length ?? 0) > 0)
			.flatMap((conversation) =>
				(conversation.latestTurn?.pendingModels ?? []).map((model) => ({
					type: "conversationPending" as const,
					key: `conversation-pending-${conversation._id}-${model}`,
					model,
					...(conversation.latestTurn?.aspectRatio
						? { aspectRatio: conversation.latestTurn.aspectRatio }
						: {}),
					title: conversation.latestTurn?.userMessage?.trim() || conversation.title,
					conversationId: conversation._id,
					updatedAt: conversation.updatedAt,
				}))
			);
	});

	let gridCards = $derived(() => {
		const cards: GridCard[] = [];
		const activeIds = new Set(batchItems.map((item) => item._id));

		for (const pendingCard of conversationPendingCards()) {
			cards.push(pendingCard);
		}

		if (showGeneratingBatchCards) {
			for (const item of batchItems) {
				cards.push({ type: "item", key: item._id, item });
			}

			for (const model of batchData?.pendingModels ?? []) {
				cards.push({
					type: "pending",
					key: `pending-${activeBatchId}-${model}`,
					model,
					...(batchData?.aspectRatio ? { aspectRatio: batchData.aspectRatio } : {}),
				});
			}
		}

		for (const item of items()) {
			if (activeIds.has(item._id)) continue;
			cards.push({ type: "item", key: item._id, item });
		}

		return cards;
	});

	let isLoading = $derived(
		(initialItemsQuery.isLoading && !initialLoadDone) ||
		(!!filterProjectId && projectItemsQuery.isLoading) ||
		(!!searchQuery.trim() && searchResultsQuery.isLoading)
	);

	let batchPendingCount = $derived(showGeneratingBatchCards ? batchData?.pendingModels?.length ?? 0 : 0);
	let conversationPendingCount = $derived(conversationPendingCards().length);
	let pendingCount = $derived(batchPendingCount + conversationPendingCount);
	let activeConversationCount = $derived(
		conversations.filter(
			(conversation) => (conversation.latestTurn?.pendingModels?.length ?? 0) > 0
		).length
	);

	function formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleDateString("pt-BR", {
			day: "2-digit",
			month: "short",
			year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
		});
	}

	function getModelDisplayName(model?: string): string {
		if (!model) return "Imagem";
		return modelDisplayNames[model] ?? model.split("/").pop() ?? model;
	}

	function getSourceLabel(sourceType: string): string {
		switch (sourceType) {
			case "generated":
				return "Gerada por IA";
			case "uploaded":
				return "Upload manual";
			case "edited":
				return "Imagem editada";
			case "imported":
				return "Imagem importada";
			default:
				return sourceType;
		}
	}

	function toAspectRatioValue(aspectRatio?: string): string {
		if (!aspectRatio) return "1 / 1";
		const [width, height] = aspectRatio.split(":");
		if (!width || !height) return "1 / 1";
		return `${width} / ${height}`;
	}

	function getMediaAspectRatio(item: Pick<MediaItem, "width" | "height" | "aspectRatio">): string {
		if (item.width > 0 && item.height > 0) {
			return `${item.width} / ${item.height}`;
		}
		return toAspectRatioValue(item.aspectRatio);
	}

	function getCardTitle(item: MediaItem): string {
		return item.model ? getModelDisplayName(item.model) : getSourceLabel(item.sourceType);
	}

	function getCardMeta(item: MediaItem): string {
		const parts = [formatDate(item.createdAt)];
		if (item.aspectRatio) {
			parts.push(item.aspectRatio);
		} else if (item.width > 0 && item.height > 0) {
			parts.push(`${item.width} × ${item.height}`);
		}
		return parts.join(" • ");
	}

	function formatRelativeTime(timestamp: number): string {
		const diff = Date.now() - timestamp;
		if (diff < 60_000) return "Agora";
		if (diff < 60 * 60_000) return `${Math.max(1, Math.floor(diff / 60_000))} min`;
		if (diff < 24 * 60 * 60_000) return `${Math.max(1, Math.floor(diff / 3_600_000))} h`;
		if (diff < 7 * 24 * 60 * 60_000) return `${Math.max(1, Math.floor(diff / 86_400_000))} d`;
		return formatDate(timestamp);
	}

	function batchLastProgressAt(batch: { lastProgressAt?: number; createdAt: number }): number {
		return batch.lastProgressAt ?? batch.createdAt;
	}

	function getConversationTitle(conversation: ConversationSummary): string {
		return conversation.latestTurn?.userMessage?.trim() || conversation.title;
	}

	function getConversationOutputCount(conversation: ConversationSummary): number {
		if (!conversation.latestTurn) return 0;
		return conversation.latestTurn.outputs.length + (conversation.latestTurn.pendingModels?.length ?? 0);
	}

	function openConversation(conversationId: Id<"image_edit_conversations">) {
		goto(`/images/conversations/${conversationId}`);
	}

	async function handleGenerate() {
		if (!prompt.trim() || isGenerating) return;
		isGenerating = true;
		error = null;

		try {
			const contextImageUrls = contextImages
				.map((image) => image.url)
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

	async function handleUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) return;

		isUploading = true;
		try {
			for (const file of Array.from(input.files)) {
				if (!file.type.startsWith("image/")) continue;

				const dimensions = await getImageDimensions(file);
				const uploadUrl = await client.mutation(api.referenceImages.generateUploadUrl, {});
				const uploadResult = await fetch(uploadUrl, {
					method: "POST",
					headers: { "Content-Type": file.type },
					body: file,
				});
				const { storageId } = await uploadResult.json();

				await client.mutation(api.mediaItems.createUploaded, {
					storageId,
					mimeType: file.type,
					width: dimensions.width,
					height: dimensions.height,
					...(selectedProjectId && { projectId: selectedProjectId }),
				});
			}

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
			const image = new Image();
			image.onload = () => {
				resolve({ width: image.width, height: image.height });
				URL.revokeObjectURL(image.src);
			};
			image.onerror = () => resolve({ width: 1024, height: 1024 });
			image.src = URL.createObjectURL(file);
		});
	}

	async function handleDelete(id: Id<"media_items">, event: Event) {
		event.stopPropagation();
		await client.mutation(api.mediaItems.softDelete, { id });
		allItems = allItems.filter((item) => item._id !== id);
	}

	async function handleDownload(url: string, event: Event) {
		event.stopPropagation();
		try {
			const response = await fetch(url);
			const blob = await response.blob();
			const blobUrl = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = blobUrl;
			link.download = `vanda-${Date.now()}.png`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(blobUrl);
		} catch (err) {
			console.error("Download failed:", err);
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
		<aside class="flex w-80 shrink-0 flex-col border-r border-border bg-muted/20 overflow-hidden">
			<div class="space-y-3 p-4">
				<h2 class="text-sm font-semibold text-foreground">Gerar Imagens</h2>

				<ProjectSelector
					value={selectedProjectId}
					onchange={(projectId) => (selectedProjectId = projectId)}
					description={null}
					compact
				/>

				<div class="space-y-1.5">
					<p class="text-xs font-medium text-muted-foreground">Prompt</p>
					<Textarea
						placeholder="Descreva a imagem que deseja gerar..."
						bind:value={prompt}
						class="min-h-[88px] resize-none text-sm"
						onkeydown={(event) => {
							if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
								event.preventDefault();
								handleGenerate();
							}
						}}
					/>
				</div>

				<div class="space-y-1.5">
					<p class="text-xs font-medium text-muted-foreground">Modelos</p>
					<ImageModelSelector selected={selectedModels} onchange={(models) => (selectedModels = models)} compact />
				</div>

				<div class="space-y-1.5">
					<p class="text-xs font-medium text-muted-foreground">Proporção</p>
					<AspectRatioSelector value={aspectRatio} onchange={(value) => (aspectRatio = value)} compact />
				</div>

				<div class="space-y-1.5">
					<p class="text-xs font-medium text-muted-foreground">Resolução</p>
					<ResolutionSelector value={resolution} onchange={(value) => (resolution = value)} compact />
				</div>

				{#if error}
					<div class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
						{error}
					</div>
				{/if}

				<Button class="w-full" disabled={!prompt.trim() || isGenerating} onclick={handleGenerate}>
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

		<main class="flex flex-1 flex-col overflow-hidden">
			<div class="shrink-0 border-b border-border bg-muted/30 px-4 py-3">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="flex flex-wrap items-center gap-3">
						{#if viewMode === "images"}
							<div class="relative">
								<input
									type="text"
									placeholder="Buscar..."
									class="flex h-9 w-72 rounded-md border border-input bg-transparent px-3 py-1 pl-9 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
									value={searchQuery}
									oninput={(event) => (searchQuery = (event.target as HTMLInputElement).value)}
								/>
								<svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
								</svg>
								{#if searchQuery}
									<button
										type="button"
										aria-label="Limpar busca"
										class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
										onclick={() => (searchQuery = "")}
									>
										<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								{/if}
							</div>

							{#if projects.length > 0}
								<Popover bind:open={projectFilterOpen}>
									<PopoverTrigger>
										<button
											type="button"
											class="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm transition-colors hover:bg-muted"
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
											class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted {filterProjectId === null ? 'bg-muted' : ''}"
											onclick={() => selectProjectFilter(null)}
										>
											<span>Todos os projetos</span>
										</button>
										<div class="my-1 border-t border-border"></div>
										{#each projects as project (project._id)}
											<button
												type="button"
												class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted {filterProjectId === project._id ? 'bg-muted' : ''}"
												onclick={() => selectProjectFilter(project._id)}
											>
												<span>{project.name}</span>
											</button>
										{/each}
									</PopoverContent>
								</Popover>
							{/if}

							<span class="text-sm text-muted-foreground">
								{items().length} imagem{items().length !== 1 ? "ns" : ""}
							</span>

							{#if pendingCount > 0}
								<Badge variant="secondary">{pendingCount} gerando</Badge>
							{/if}
						{:else}
							<div>
								<p class="text-sm font-semibold text-foreground">Conversas de imagem</p>
								<p class="mt-1 text-xs text-muted-foreground">
									Continue uma edição em andamento ou retome um fio visual anterior.
								</p>
							</div>
							<span class="text-sm text-muted-foreground">
								{conversations.length} conversa{conversations.length !== 1 ? "s" : ""}
							</span>
							{#if activeConversationCount > 0}
								<Badge variant="secondary">{activeConversationCount} ativa{activeConversationCount !== 1 ? "s" : ""}</Badge>
							{/if}
						{/if}
					</div>

					<div class="flex overflow-hidden rounded-xl border border-border bg-card">
						<button
							type="button"
							class="flex h-10 w-10 items-center justify-center text-sm transition-colors {viewMode === 'images' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}"
							aria-label="Ver imagens"
							onclick={() => setViewMode("images")}
						>
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M4.75 4.75h5.5v5.5h-5.5zm9 0h5.5v5.5h-5.5zm-9 9h5.5v5.5h-5.5zm9 0h5.5v5.5h-5.5z" />
							</svg>
						</button>
						<button
							type="button"
							class="flex h-10 w-10 items-center justify-center text-sm transition-colors {viewMode === 'conversations' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}"
							aria-label="Ver conversas"
							onclick={() => setViewMode("conversations")}
						>
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M4 12h16M4 17h16" />
							</svg>
						</button>
					</div>
				</div>
			</div>

			<div class="flex-1 overflow-y-auto">
				<SignedOut>
					<div class="flex flex-1 flex-col items-center justify-center gap-6 py-20">
						<h2 class="text-2xl font-bold">Entre para ver suas imagens</h2>
						<SignInButton mode="modal">
							<button class="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
								Entrar
							</button>
						</SignInButton>
					</div>
				</SignedOut>

				<SignedIn>
					{#if viewMode === "images" && isLoading}
						<div class="flex items-center justify-center py-20">
							<svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
						</div>
					{:else if viewMode === "conversations" && conversationsQuery.isLoading}
						<div class="flex items-center justify-center py-20">
							<svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
						</div>
					{:else if viewMode === "images" && gridCards().length === 0}
						<div class="flex flex-col items-center justify-center py-20">
							<div class="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/50">
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
					{:else if viewMode === "conversations" && conversations.length === 0}
						<div class="flex flex-col items-center justify-center py-20">
							<div class="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-card/70 shadow-sm">
								<svg class="h-10 w-10 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
								</svg>
							</div>
							<h3 class="mt-6 text-lg font-medium">Nenhuma conversa ainda</h3>
							<p class="mt-2 text-sm text-muted-foreground">
								Abra qualquer imagem e inicie uma conversa para continuar refinando os resultados.
							</p>
						</div>
					{:else}
						<div class="p-5 sm:p-6">
							{#if viewMode === "images"}
								<div class="columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5">
									{#each gridCards() as card (card.key)}
										<div class="group relative mb-5 break-inside-avoid">
											{#if card.type === "item"}
												<button
													type="button"
													class="w-full overflow-hidden rounded-xl border border-border/80 bg-card/80 text-left shadow-sm transition hover:border-border hover:bg-card"
													onclick={() => openLightbox(card.item._id)}
												>
													<div class="relative overflow-hidden bg-muted" style={`aspect-ratio: ${getMediaAspectRatio(card.item)};`}>
														{#if card.item.url}
															<img
																src={card.item.thumbnailUrl ?? card.item.url}
																alt={card.item.userPrompt ?? card.item.prompt ?? "Imagem"}
																loading="lazy"
																decoding="async"
																class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
															/>
														{:else}
															<div class="flex h-full w-full items-center justify-center">
																<svg class="h-12 w-12 text-muted-foreground/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
																	<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
																</svg>
															</div>
														{/if}

														{#if card.item.sourceType !== "generated"}
															<div class="absolute left-3 top-3">
																<Badge variant="secondary" class="bg-black/60 text-white backdrop-blur-sm">
																	{getSourceLabel(card.item.sourceType)}
																</Badge>
															</div>
														{/if}
													</div>

													<div class="px-3 py-3">
														<p class="truncate text-sm font-semibold text-foreground">
															{getCardTitle(card.item)}
														</p>
														<p class="mt-1 truncate text-xs text-muted-foreground">
															{getCardMeta(card.item)}
														</p>
													</div>
												</button>

												<div class="pointer-events-none absolute inset-x-3 top-3 flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
													{#if card.item.url}
														<button
															type="button"
															aria-label="Baixar imagem"
															class="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/70"
															onclick={(event) => handleDownload(card.item.url!, event)}
														>
															<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
																<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
															</svg>
														</button>
													{/if}

													<button
														type="button"
														aria-label="Excluir imagem"
														class="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-sm transition hover:bg-red-500/70"
														onclick={(event) => handleDelete(card.item._id, event)}
													>
														<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
														</svg>
													</button>
												</div>
											{:else}
												{#if card.type === "conversationPending"}
													<button
														type="button"
														class="w-full overflow-hidden rounded-xl border border-dashed border-primary/30 bg-card/60 text-left shadow-sm transition hover:border-primary/50 hover:bg-card/80"
														onclick={() => openConversation(card.conversationId)}
													>
														<div class="relative bg-muted/30" style={`aspect-ratio: ${toAspectRatioValue(card.aspectRatio)};`}>
															<div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_35%),linear-gradient(to_bottom,rgba(255,255,255,0.02),rgba(255,255,255,0.06))]"></div>
															<div class="absolute left-3 top-3">
																<Badge variant="secondary" class="bg-black/55 text-white backdrop-blur-sm">
																	Conversa
																</Badge>
															</div>
															<div class="relative flex h-full w-full flex-col items-center justify-center gap-3">
																<svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
																	<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
																	<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
																</svg>
																<span class="text-xs text-muted-foreground">Gerando...</span>
															</div>
														</div>
														<div class="px-3 py-3">
															<p class="truncate text-sm font-semibold text-foreground">
																{getModelDisplayName(card.model)}
															</p>
															<p class="mt-1 line-clamp-2 text-xs text-muted-foreground">
																{card.title}
															</p>
														</div>
													</button>
												{:else}
													<div class="overflow-hidden rounded-xl border border-dashed border-primary/30 bg-card/60 shadow-sm">
														<div class="relative bg-muted/30" style={`aspect-ratio: ${toAspectRatioValue(card.aspectRatio)};`}>
															<div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_35%),linear-gradient(to_bottom,rgba(255,255,255,0.02),rgba(255,255,255,0.06))]"></div>
															<div class="relative flex h-full w-full flex-col items-center justify-center gap-3">
																<svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
																	<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
																	<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
																</svg>
																<span class="text-xs text-muted-foreground">Gerando...</span>
															</div>
														</div>
														<div class="px-3 py-3">
															<p class="truncate text-sm font-semibold text-foreground">
																{getModelDisplayName(card.model)}
															</p>
															<p class="mt-1 truncate text-xs text-muted-foreground">
																Novo resultado em andamento
															</p>
														</div>
													</div>
												{/if}
											{/if}
										</div>
									{/each}
								</div>

								{#if !filterProjectId && !searchQuery.trim()}
									<div bind:this={sentinelEl} class="h-1" aria-hidden="true"></div>
									{#if loadingMore}
										<div class="flex items-center justify-center py-8">
											<svg class="h-6 w-6 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
												<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
												<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
											</svg>
										</div>
									{/if}
								{/if}
							{:else}
								<div class="mx-auto flex w-full max-w-5xl flex-col gap-5">
									{#each conversations as conversation (conversation._id)}
										<button
											type="button"
											class="group w-full rounded-[28px] border border-border bg-card/65 px-5 py-5 text-left shadow-sm transition hover:border-primary/30 hover:bg-card"
											onclick={() => openConversation(conversation._id)}
										>
											<div class="flex flex-wrap items-start justify-between gap-4">
												<div class="min-w-0">
													<div class="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
														<div class="h-2 w-2 rounded-full bg-primary"></div>
														<span>{formatRelativeTime(conversation.updatedAt)}</span>
														<span>{getConversationOutputCount(conversation)} output{getConversationOutputCount(conversation) === 1 ? "" : "s"}</span>
														{#if (conversation.latestTurn?.pendingModels?.length ?? 0) > 0}
															<span>{conversation.latestTurn?.pendingModels?.length} gerando</span>
														{/if}
													</div>
													<h3 class="mt-3 text-lg font-semibold leading-tight text-foreground">
														{getConversationTitle(conversation)}
													</h3>
													<p class="mt-1 text-sm text-muted-foreground">
														{conversation.turnCount} turno{conversation.turnCount === 1 ? "" : "s"} nesta conversa
													</p>
												</div>

												{#if conversation.sourceImageUrl}
													<div class="flex items-center gap-2 rounded-full border border-border bg-background/80 px-2 py-1.5">
														<div class="h-9 w-9 overflow-hidden rounded-lg border border-border bg-muted">
															<img src={conversation.sourceImageUrl} alt="" class="h-full w-full object-cover" />
														</div>
														<div class="text-left">
															<p class="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Source</p>
															<p class="text-xs font-medium text-foreground">Imagem base</p>
														</div>
													</div>
												{/if}
											</div>

											{#if conversation.latestTurn}
												<div class="mt-5 flex gap-4 overflow-x-auto pb-1">
													{#each conversation.latestTurn.outputs as output (output._id)}
														<div class="w-[168px] shrink-0 overflow-hidden rounded-2xl border border-border bg-background/80">
															<div class="overflow-hidden bg-muted" style={`aspect-ratio: ${output.width} / ${output.height};`}>
																{#if output.url}
																	<img src={output.thumbnailUrl ?? output.url} alt={getModelDisplayName(output.model)} loading="lazy" decoding="async" class="h-full w-full object-cover" />
																{/if}
															</div>
															<div class="px-3 py-3">
																<p class="truncate text-sm font-medium text-foreground">{getModelDisplayName(output.model)}</p>
															</div>
														</div>
													{/each}

													{#each conversation.latestTurn.pendingModels ?? [] as pendingModel (pendingModel)}
														<div class="w-[168px] shrink-0 overflow-hidden rounded-2xl border border-border bg-background/80">
															<ImageSkeleton model={pendingModel} aspectRatio={conversation.latestTurn.aspectRatio} />
															<div class="px-3 py-3">
																<p class="truncate text-sm font-medium text-foreground">{getModelDisplayName(pendingModel)}</p>
															</div>
														</div>
													{/each}
												</div>
											{/if}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</SignedIn>
			</div>
		</main>
	</div>
</div>

{#if viewMode === "images" && lightboxOpen && lightboxMediaId && items().length > 0}
	<MediaLightbox
		items={items()}
		currentMediaId={lightboxMediaId}
		onclose={closeLightbox}
		onnavigate={navigateLightbox}
	/>
{/if}
