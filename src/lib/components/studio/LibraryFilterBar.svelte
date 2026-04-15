<script lang="ts">
	import { Popover, PopoverContent, PopoverTrigger, Button, Separator } from "$lib/components/ui";
	import type { MediaSortOrder, MediaSourceFilter } from "$lib/studio/mediaBrowserFilters";
	import type {
		LibraryGalleryAssetFilter,
		LibraryPostPlatformFilter,
		LibraryPostSchedulingFilter,
	} from "$lib/studio/libraryPageFiltersState";

	type ProjectOption = {
		_id: string;
		name: string;
		profilePictureStorageUrl?: string | null;
		profilePictureUrl?: string | null;
		logoStorageUrl?: string | null;
	};

	type ModelOption = {
		id: string;
		label: string;
	};

	interface Props {
		projects: ProjectOption[];
		selectedProjectId: string | null;
		modelOptions: ModelOption[];
		selectedModel: string;
		sourceFilter: MediaSourceFilter;
		sortOrder: MediaSortOrder;
		galleryAssetFilter: LibraryGalleryAssetFilter;
		postPlatformFilter: LibraryPostPlatformFilter;
		postSchedulingFilter: LibraryPostSchedulingFilter;
		gallerySearch: string;
		onprojectchange: (projectId: string | null) => void;
		onmodelchange: (model: string) => void;
		onsourcechange: (source: MediaSourceFilter) => void;
		onsortchange: (sortOrder: MediaSortOrder) => void;
		ongalleryassetchange: (value: LibraryGalleryAssetFilter) => void;
		onpostplatformchange: (value: LibraryPostPlatformFilter) => void;
		onpostschedulingchange: (value: LibraryPostSchedulingFilter) => void;
		ongallerysearchinput: (value: string) => void;
	}

	let {
		projects,
		selectedProjectId,
		modelOptions,
		selectedModel,
		sourceFilter,
		sortOrder,
		galleryAssetFilter,
		postPlatformFilter,
		postSchedulingFilter,
		gallerySearch,
		onprojectchange,
		onmodelchange,
		onsourcechange,
		onsortchange,
		ongalleryassetchange,
		onpostplatformchange,
		onpostschedulingchange,
		ongallerysearchinput,
	}: Props = $props();

	let filtersOpen = $state(false);

	const assetOptions: Array<{ value: LibraryGalleryAssetFilter; label: string }> = [
		{ value: "all", label: "Tudo" },
		{ value: "media", label: "Só mídia" },
		{ value: "posts", label: "Só posts" },
	];

	const platformOptions: Array<{ value: LibraryPostPlatformFilter; label: string; disabled?: boolean }> = [
		{ value: "all", label: "Todas" },
		{ value: "instagram", label: "Instagram" },
		{ value: "twitter", label: "X", disabled: true },
		{ value: "linkedin", label: "LinkedIn", disabled: true },
	];

	const schedulingOptions: Array<{ value: LibraryPostSchedulingFilter; label: string }> = [
		{ value: "all", label: "Todos" },
		{ value: "draft", label: "Rascunho" },
		{ value: "scheduled", label: "Agendado" },
	];

	const sourceOptions: Array<{ value: MediaSourceFilter; label: string }> = [
		{ value: "all", label: "Todas" },
		{ value: "generated_uploaded", label: "Geradas ou uploads" },
		{ value: "edited", label: "Editadas" },
	];

	const sortOptions: Array<{ value: MediaSortOrder; label: string }> = [
		{ value: "newest", label: "Mais recentes" },
		{ value: "oldest", label: "Mais antigas" },
	];

	const showMediaModelSource = $derived(galleryAssetFilter !== "posts");
	const showPostFilters = $derived(galleryAssetFilter !== "media");

	const hasActiveFilters = $derived(
		galleryAssetFilter !== "all" ||
			postPlatformFilter !== "all" ||
			postSchedulingFilter !== "all" ||
			selectedProjectId !== null ||
			selectedModel !== "all" ||
			sourceFilter !== "all" ||
			sortOrder !== "newest"
	);

	function resetFilters() {
		ongalleryassetchange("all");
		onpostplatformchange("all");
		onpostschedulingchange("all");
		onprojectchange(null);
		onmodelchange("all");
		onsourcechange("all");
		onsortchange("newest");
	}

	const rowBase =
		"flex w-full items-center gap-2 rounded-none border px-2.5 py-2 text-left text-xs transition-colors hover:bg-muted";
	const rowOff = "border-transparent";
	const rowOn = "border-primary/40 bg-primary/10";
</script>

<div class="flex w-full min-w-0 items-center gap-2">
	<div class="relative min-w-0 flex-1">
		<span class="pointer-events-none absolute left-2.5 top-1/2 z-[1] -translate-y-1/2 text-muted-foreground" aria-hidden="true">
			<svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
			</svg>
		</span>
		<input
			type="search"
			placeholder="Buscar na galeria…"
			class="h-9 w-full min-w-0 border border-border bg-background py-2 pl-8 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			value={gallerySearch}
			oninput={(e) => ongallerysearchinput(e.currentTarget.value)}
			aria-label="Buscar na galeria"
		/>
	</div>

	<Popover bind:open={filtersOpen}>
		<PopoverTrigger>
			<Button
				type="button"
				variant="outline"
				size="sm"
				class="relative h-9 shrink-0 gap-2 rounded-none border-border px-3 {filtersOpen ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''}"
				aria-expanded={filtersOpen}
				aria-haspopup="dialog"
				aria-label="Filtros da galeria"
			>
				<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
				</svg>
				<span class="hidden sm:inline">Filtros</span>
				{#if hasActiveFilters}
					<span
						class="absolute -right-0.5 -top-0.5 flex h-2 w-2 rounded-full bg-primary shadow-sm"
						aria-hidden="true"
					></span>
				{/if}
			</Button>
		</PopoverTrigger>
		<PopoverContent
			class="w-[min(calc(100vw-2rem),20rem)] max-h-[min(70vh,28rem)] overflow-y-auto overflow-x-hidden border-border p-0"
			align="end"
		>
			<div class="border-b border-border bg-muted/40 px-3 py-2.5">
				<p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filtros</p>
				<p class="mt-0.5 text-[11px] leading-snug text-muted-foreground">Mostrar na galeria</p>
			</div>

			<div class="space-y-4 p-3">
				<div class="space-y-2">
					<p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tipo</p>
					<div class="grid grid-cols-1 gap-1">
						{#each assetOptions as option (option.value)}
							<button
								type="button"
								class="{rowBase} {galleryAssetFilter === option.value ? rowOn : rowOff}"
								onclick={() => ongalleryassetchange(option.value)}
							>
								<span class="flex-1">{option.label}</span>
								{#if galleryAssetFilter === option.value}
									<svg class="h-3.5 w-3.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
									</svg>
								{/if}
							</button>
						{/each}
					</div>
				</div>

				<Separator />

				<div class="space-y-2">
					<p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Projeto</p>
					<div class="max-h-36 space-y-1 overflow-y-auto pr-0.5">
						<button
							type="button"
							class="{rowBase} {selectedProjectId === null ? rowOn : rowOff}"
							onclick={() => onprojectchange(null)}
						>
							<span class="text-muted-foreground">Todos os projetos</span>
							{#if selectedProjectId === null}
								<svg class="ml-auto h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
								</svg>
							{/if}
						</button>
						{#each projects as project (project._id)}
							<button
								type="button"
								class="{rowBase} {selectedProjectId === project._id ? rowOn : rowOff}"
								onclick={() => onprojectchange(project._id)}
							>
								<div class="h-6 w-6 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
									{#if project.logoStorageUrl ?? project.profilePictureStorageUrl ?? project.profilePictureUrl}
										<img src={project.logoStorageUrl ?? project.profilePictureStorageUrl ?? project.profilePictureUrl} alt="" class="h-full w-full object-cover" />
									{:else}
										<span class="flex h-full w-full items-center justify-center text-[9px] font-bold text-muted-foreground">{project.name[0]?.toUpperCase()}</span>
									{/if}
								</div>
								<span class="min-w-0 flex-1 truncate">{project.name}</span>
								{#if selectedProjectId === project._id}
									<svg class="h-3.5 w-3.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
									</svg>
								{/if}
							</button>
						{/each}
					</div>
				</div>

				{#if showMediaModelSource}
					<Separator />
					<div class="space-y-2">
						<p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Modelo (mídia)</p>
						<div class="max-h-32 space-y-1 overflow-y-auto">
							<button
								type="button"
								class="{rowBase} {selectedModel === 'all' ? rowOn : rowOff}"
								onclick={() => onmodelchange("all")}
							>
								<span class="text-muted-foreground">Todos</span>
								{#if selectedModel === "all"}
									<svg class="ml-auto h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
									</svg>
								{/if}
							</button>
							{#each modelOptions as option (option.id)}
								<button
									type="button"
									class="{rowBase} {selectedModel === option.id ? rowOn : rowOff}"
									onclick={() => onmodelchange(option.id)}
								>
									<span class="min-w-0 flex-1 truncate">{option.label}</span>
									{#if selectedModel === option.id}
										<svg class="h-3.5 w-3.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
										</svg>
									{/if}
								</button>
							{/each}
						</div>
					</div>

					<div class="space-y-2">
						<p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Origem</p>
						<div class="space-y-1">
							{#each sourceOptions as option (option.value)}
								<button
									type="button"
									class="{rowBase} {sourceFilter === option.value ? rowOn : rowOff}"
									onclick={() => onsourcechange(option.value)}
								>
									<span class="min-w-0 flex-1 {option.value === 'all' ? 'text-muted-foreground' : ''}">{option.label}</span>
									{#if sourceFilter === option.value}
										<svg class="h-3.5 w-3.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
										</svg>
									{/if}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<div class="space-y-2">
					<p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Ordenação</p>
					<div class="space-y-1">
						{#each sortOptions as option (option.value)}
							<button
								type="button"
								class="{rowBase} {sortOrder === option.value ? rowOn : rowOff}"
								onclick={() => onsortchange(option.value)}
							>
								<span class="flex-1">{option.label}</span>
								{#if sortOrder === option.value}
									<svg class="h-3.5 w-3.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
									</svg>
								{/if}
							</button>
						{/each}
					</div>
				</div>

				{#if showPostFilters}
					<Separator />
					<div class="space-y-2">
						<p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Plataforma (posts)</p>
						<div class="space-y-1">
							{#each platformOptions as option (option.value)}
								<button
									type="button"
									disabled={option.disabled}
									class="{rowBase} {postPlatformFilter === option.value ? rowOn : rowOff} disabled:cursor-not-allowed disabled:opacity-40"
									onclick={() => {
										if (!option.disabled) onpostplatformchange(option.value);
									}}
								>
									<span class="flex-1 {option.value === 'all' ? 'text-muted-foreground' : ''}">{option.label}</span>
									{#if postPlatformFilter === option.value}
										<svg class="h-3.5 w-3.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
										</svg>
									{/if}
								</button>
							{/each}
						</div>
					</div>

					<div class="space-y-2">
						<p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status (posts)</p>
						<div class="space-y-1">
							{#each schedulingOptions as option (option.value)}
								<button
									type="button"
									class="{rowBase} {postSchedulingFilter === option.value ? rowOn : rowOff}"
									onclick={() => onpostschedulingchange(option.value)}
								>
									<span class="flex-1 {option.value === 'all' ? 'text-muted-foreground' : ''}">{option.label}</span>
									{#if postSchedulingFilter === option.value}
										<svg class="h-3.5 w-3.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
										</svg>
									{/if}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				{#if hasActiveFilters}
					<Separator />
					<Button variant="ghost" size="sm" class="h-8 w-full text-xs text-muted-foreground" onclick={resetFilters}>
						Limpar filtros
					</Button>
				{/if}
			</div>
		</PopoverContent>
	</Popover>
</div>
