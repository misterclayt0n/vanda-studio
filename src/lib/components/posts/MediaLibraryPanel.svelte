<script lang="ts">
	import { Button } from "$lib/components/ui";
	import { goto } from "$app/navigation";
	import { useConvexClient, useQuery } from "convex-svelte";
	import { api } from "../../../convex/_generated/api.js";
	import type { Id } from "../../../convex/_generated/dataModel.js";
	import { MediaBrowserFilterBar } from "$lib/components/studio";
	import {
		filterMediaItems,
		getMediaModelOptions,
		type MediaSortOrder,
		type MediaSourceFilter,
	} from "$lib/studio/mediaBrowserFilters";

	type MediaItem = {
		_id: Id<"media_items">;
		url: string | null;
		thumbnailUrl?: string | null;
		model?: string;
		prompt?: string;
		sourceType: string;
		width: number;
		height: number;
		mimeType: string;
		projectId?: Id<"projects">;
		createdAt: number;
	};

	type ProjectOption = {
		_id: Id<"projects">;
		name: string;
		profilePictureStorageUrl?: string | null;
		profilePictureUrl?: string | null;
	};

	interface Props {
		selectedIds: Id<"media_items">[];
		projectId?: Id<"projects"> | null;
		max?: number;
		onselect: (id: Id<"media_items">) => void;
		ondeselect: (id: Id<"media_items">) => void;
	}

	let { selectedIds, projectId, max = 10, onselect, ondeselect }: Props = $props();

	const client = useConvexClient();
	const mediaItemsQuery = useQuery(api.mediaItems.listAllCardsByUser, {});
	const projectsQuery = useQuery(api.projects.list, {});

	let libraryFilterProjectId = $state<Id<"projects"> | null>(null);
	let filterModel = $state("all");
	let filterSource = $state<MediaSourceFilter>("all");
	let sortOrder = $state<MediaSortOrder>("newest");
	let requestedThumbnailIds = $state<string[]>([]);

	$effect(() => {
		if (projectId && libraryFilterProjectId === null) {
			libraryFilterProjectId = projectId;
		}

		if (!projectId && libraryFilterProjectId && !projects.some((project) => project._id === libraryFilterProjectId)) {
			libraryFilterProjectId = null;
		}
	});

	let libraryBaseItems = $derived((mediaItemsQuery.data ?? []) as MediaItem[]);
	let projects = $derived((projectsQuery.data ?? []) as ProjectOption[]);
	let modelOptions = $derived(getMediaModelOptions(libraryBaseItems));
	let filtersAreDefault = $derived(
		libraryFilterProjectId === null &&
		filterModel === "all" &&
		filterSource === "all" &&
		sortOrder === "newest"
	);

	$effect(() => {
		const idsToEnsure = libraryBaseItems
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

	let libraryItems = $derived.by(() => {
		return filterMediaItems(libraryBaseItems, {
			projectId: libraryFilterProjectId,
			model: filterModel,
			source: filterSource,
			sortOrder,
		});
	});

	// Masonry layout
	const CARD_META_HEIGHT = 0.1;

	function getCardAspectHeight(item: MediaItem): number {
		if (item.width > 0 && item.height > 0) {
			return item.height / item.width + CARD_META_HEIGHT;
		}
		return 1 + CARD_META_HEIGHT;
	}

	let columnCount = $state(2);

	let columnItems = $derived.by(() => {
		const cols: MediaItem[][] = Array.from({ length: columnCount }, () => []);
		const heights = new Array(columnCount).fill(0);
		for (const item of libraryItems) {
			const shortest = heights.indexOf(Math.min(...heights));
			const column = cols[shortest];
			if (!column) continue;
			column.push(item);
			heights[shortest] += getCardAspectHeight(item);
		}
		return cols;
	});

	function isSelected(id: Id<"media_items">): boolean {
		return selectedIds.includes(id);
	}

	function selectionIndex(id: Id<"media_items">): number {
		return selectedIds.indexOf(id) + 1;
	}

	function toggle(item: MediaItem) {
		if (isSelected(item._id)) {
			ondeselect(item._id);
		} else if (selectedIds.length < max) {
			onselect(item._id);
		}
	}

	function isVideo(item: MediaItem): boolean {
		return item.mimeType.startsWith("video/");
	}
</script>

	<div class="flex h-full flex-col">
		<!-- Controls -->
		<div class="shrink-0 space-y-3 border-b border-border p-4">
			<div class="flex items-center justify-between gap-3">
				<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Filtros
				</p>
				<span class="text-xs text-muted-foreground">{selectedIds.length}/{max}</span>
			</div>
			<MediaBrowserFilterBar
				{projects}
				selectedProjectId={libraryFilterProjectId}
				{modelOptions}
				selectedModel={filterModel}
				sourceFilter={filterSource}
				{sortOrder}
				onprojectchange={(nextProjectId) => {
					libraryFilterProjectId = nextProjectId as Id<"projects"> | null;
				}}
				onmodelchange={(model) => {
					filterModel = model;
				}}
				onsourcechange={(source) => {
					filterSource = source;
				}}
				onsortchange={(nextSortOrder) => {
					sortOrder = nextSortOrder;
				}}
			/>
		</div>

		<!-- Grid -->
		<div class="min-h-0 flex-1 overflow-y-auto p-3">
			{#if mediaItemsQuery.isLoading}
				<div class="flex items-center justify-center py-12">
					<svg class="h-6 w-6 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
			</div>
			{:else if libraryItems.length === 0}
				<div class="flex flex-col items-center justify-center border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
					<h3 class="text-sm font-medium">Nenhuma imagem</h3>
					<p class="mt-1 text-xs text-muted-foreground">
						{!filtersAreDefault
							? "Ajuste os filtros para ver mais imagens."
							: "Sua biblioteca está vazia."}
					</p>
					<Button class="mt-3" size="sm" onclick={() => goto("/images")}>
						Criar imagens
				</Button>
			</div>
		{:else}
			<div class="flex gap-2">
				{#each columnItems as column, colIdx (colIdx)}
					<div class="flex flex-1 flex-col gap-2">
						{#each column as item (item._id)}
							{@const selected = isSelected(item._id)}
							{@const idx = selectionIndex(item._id)}
							{@const canSelect = selected || selectedIds.length < max}
							<button
								type="button"
								class="relative overflow-hidden border text-left transition-colors {selected
									? 'border-primary ring-1 ring-primary/30'
									: canSelect
										? 'border-border hover:border-primary/40'
										: 'border-border opacity-50 cursor-not-allowed'}"
								onclick={() => toggle(item)}
								disabled={!canSelect && !selected}
							>
								{#if item.url}
									{#if isVideo(item)}
										<div
											class="relative w-full bg-neutral-800"
											style="aspect-ratio: {item.width > 0 && item.height > 0 ? `${item.width} / ${item.height}` : '1 / 1'};"
										>
											<div class="flex h-full w-full items-center justify-center">
												<svg class="h-6 w-6 text-white/70" fill="currentColor" viewBox="0 0 24 24">
													<path d="M8 5v14l11-7z" />
												</svg>
											</div>
										</div>
									{:else}
										<img
											src={item.thumbnailUrl ?? item.url}
											alt=""
											class="w-full object-cover"
											style="aspect-ratio: {item.width > 0 && item.height > 0 ? `${item.width} / ${item.height}` : '1 / 1'};"
											loading="lazy"
											decoding="async"
										/>
									{/if}
								{:else}
									<div class="aspect-square w-full bg-muted"></div>
								{/if}

								<!-- Selection badge -->
								{#if selected}
									<div class="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-none bg-primary text-[10px] font-bold text-primary-foreground shadow">
										{idx}
									</div>
								{/if}

								<!-- Video badge -->
								{#if isVideo(item)}
									<div class="absolute left-1.5 top-1.5">
										<div class="flex h-4 items-center gap-0.5 bg-black/70 px-1 text-[9px] text-white">
											<svg class="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
											VIDEO
										</div>
									</div>
								{/if}
							</button>
						{/each}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
