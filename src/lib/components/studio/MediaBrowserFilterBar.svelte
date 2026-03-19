<script lang="ts">
	import { Popover, PopoverContent, PopoverTrigger } from "$lib/components/ui";
	import type { MediaSortOrder, MediaSourceFilter } from "$lib/studio/mediaBrowserFilters";

	type ProjectOption = {
		_id: string;
		name: string;
		profilePictureStorageUrl?: string | null;
		profilePictureUrl?: string | null;
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
		onprojectchange: (projectId: string | null) => void;
		onmodelchange: (model: string) => void;
		onsourcechange: (source: MediaSourceFilter) => void;
		onsortchange: (sortOrder: MediaSortOrder) => void;
	}

	let {
		projects,
		selectedProjectId,
		modelOptions,
		selectedModel,
		sourceFilter,
		sortOrder,
		onprojectchange,
		onmodelchange,
		onsourcechange,
		onsortchange,
	}: Props = $props();

	let projectFilterOpen = $state(false);
	let modelFilterOpen = $state(false);
	let sourceFilterOpen = $state(false);
	let sortFilterOpen = $state(false);

	const selectedProject = $derived(projects.find((project) => project._id === selectedProjectId) ?? null);
	const selectedModelOption = $derived(
		modelOptions.find((option) => option.id === selectedModel) ?? null
	);

	const sourceOptions: Array<{ value: MediaSourceFilter; label: string }> = [
		{ value: "all", label: "Todas origens" },
		{ value: "generated_uploaded", label: "Geradas ou uploads" },
		{ value: "edited", label: "Editadas" },
	];

	const sortOptions: Array<{ value: MediaSortOrder; label: string }> = [
		{ value: "newest", label: "Mais recentes" },
		{ value: "oldest", label: "Mais antigas" },
	];

	const selectedSourceLabel = $derived(
		sourceOptions.find((option) => option.value === sourceFilter)?.label ?? "Todas origens"
	);
	const selectedSortLabel = $derived(
		sortOptions.find((option) => option.value === sortOrder)?.label ?? "Mais recentes"
	);
</script>

<div class="flex flex-wrap items-center gap-2">
	<Popover bind:open={projectFilterOpen}>
		<PopoverTrigger>
			<button
				type="button"
				class="flex h-8 min-w-[11rem] items-center justify-between border border-border bg-background px-2 text-xs transition-colors hover:bg-muted {projectFilterOpen ? 'ring-1 ring-ring' : ''}"
			>
				<div class="flex min-w-0 items-center gap-2">
					{#if selectedProject}
						<div class="h-4 w-4 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
							{#if selectedProject.profilePictureStorageUrl ?? selectedProject.profilePictureUrl}
								<img src={selectedProject.profilePictureStorageUrl ?? selectedProject.profilePictureUrl} alt="" class="h-full w-full object-cover" />
							{:else}
								<span class="flex h-full w-full items-center justify-center text-[8px] font-bold text-muted-foreground">
									{selectedProject.name[0]?.toUpperCase()}
								</span>
							{/if}
						</div>
						<span class="truncate">{selectedProject.name}</span>
					{:else}
						<span class="text-muted-foreground">Todos os projetos</span>
					{/if}
				</div>
				<svg class="h-3 w-3 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
				</svg>
			</button>
		</PopoverTrigger>
		<PopoverContent class="w-[var(--popover-trigger-width)] p-1" align="start">
			<button
				type="button"
				class="flex w-full items-center gap-2 px-2 py-1.5 text-xs transition-colors hover:bg-muted {selectedProjectId === null ? 'bg-muted' : ''}"
				onclick={() => {
					onprojectchange(null);
					projectFilterOpen = false;
				}}
			>
				<span class="text-muted-foreground">Todos os projetos</span>
				{#if selectedProjectId === null}
					<svg class="ml-auto h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
					</svg>
				{/if}
			</button>
			{#if projects.length > 0}
				<div class="my-0.5 border-t border-border"></div>
			{/if}
			{#each projects as project (project._id)}
				<button
					type="button"
					class="flex w-full items-center gap-2 px-2 py-1.5 text-xs transition-colors hover:bg-muted {selectedProjectId === project._id ? 'bg-muted' : ''}"
					onclick={() => {
						onprojectchange(project._id);
						projectFilterOpen = false;
					}}
				>
					<div class="h-4 w-4 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
						{#if project.profilePictureStorageUrl ?? project.profilePictureUrl}
							<img src={project.profilePictureStorageUrl ?? project.profilePictureUrl} alt="" class="h-full w-full object-cover" />
						{:else}
							<span class="flex h-full w-full items-center justify-center text-[8px] font-bold text-muted-foreground">{project.name[0]?.toUpperCase()}</span>
						{/if}
					</div>
					<span class="truncate">{project.name}</span>
					{#if selectedProjectId === project._id}
						<svg class="ml-auto h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
						</svg>
					{/if}
				</button>
			{/each}
		</PopoverContent>
	</Popover>

	<Popover bind:open={modelFilterOpen}>
		<PopoverTrigger>
			<button
				type="button"
				class="flex h-8 min-w-[10rem] items-center justify-between border border-border bg-background px-2 text-xs transition-colors hover:bg-muted {modelFilterOpen ? 'ring-1 ring-ring' : ''}"
			>
				<span class="truncate {selectedModel === 'all' ? 'text-muted-foreground' : ''}">
					{selectedModelOption?.label ?? "Todos os modelos"}
				</span>
				<svg class="h-3 w-3 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
				</svg>
			</button>
		</PopoverTrigger>
		<PopoverContent class="w-[var(--popover-trigger-width)] p-1" align="start">
			<button
				type="button"
				class="flex w-full items-center gap-2 px-2 py-1.5 text-xs transition-colors hover:bg-muted {selectedModel === 'all' ? 'bg-muted' : ''}"
				onclick={() => {
					onmodelchange("all");
					modelFilterOpen = false;
				}}
			>
				<span class="text-muted-foreground">Todos os modelos</span>
				{#if selectedModel === "all"}
					<svg class="ml-auto h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
					</svg>
				{/if}
			</button>
			{#if modelOptions.length > 0}
				<div class="my-0.5 border-t border-border"></div>
			{/if}
			{#each modelOptions as option (option.id)}
				<button
					type="button"
					class="flex w-full items-center gap-2 px-2 py-1.5 text-xs transition-colors hover:bg-muted {selectedModel === option.id ? 'bg-muted' : ''}"
					onclick={() => {
						onmodelchange(option.id);
						modelFilterOpen = false;
					}}
				>
					<span class="truncate">{option.label}</span>
					{#if selectedModel === option.id}
						<svg class="ml-auto h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
						</svg>
					{/if}
				</button>
			{/each}
		</PopoverContent>
	</Popover>

	<Popover bind:open={sourceFilterOpen}>
		<PopoverTrigger>
			<button
				type="button"
				class="flex h-8 min-w-[10rem] items-center justify-between border border-border bg-background px-2 text-xs transition-colors hover:bg-muted {sourceFilterOpen ? 'ring-1 ring-ring' : ''}"
			>
				<span class="truncate {sourceFilter === 'all' ? 'text-muted-foreground' : ''}">{selectedSourceLabel}</span>
				<svg class="h-3 w-3 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
				</svg>
			</button>
		</PopoverTrigger>
		<PopoverContent class="w-[var(--popover-trigger-width)] p-1" align="start">
			{#each sourceOptions as option (option.value)}
				<button
					type="button"
					class="flex w-full items-center gap-2 px-2 py-1.5 text-xs transition-colors hover:bg-muted {sourceFilter === option.value ? 'bg-muted' : ''}"
					onclick={() => {
						onsourcechange(option.value);
						sourceFilterOpen = false;
					}}
				>
					<span class={option.value === "all" ? "text-muted-foreground" : ""}>{option.label}</span>
					{#if sourceFilter === option.value}
						<svg class="ml-auto h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
						</svg>
					{/if}
				</button>
			{/each}
		</PopoverContent>
	</Popover>

	<Popover bind:open={sortFilterOpen}>
		<PopoverTrigger>
			<button
				type="button"
				class="flex h-8 min-w-[9rem] items-center justify-between border border-border bg-background px-2 text-xs transition-colors hover:bg-muted {sortFilterOpen ? 'ring-1 ring-ring' : ''}"
			>
				<span class="truncate">{selectedSortLabel}</span>
				<svg class="h-3 w-3 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
				</svg>
			</button>
		</PopoverTrigger>
		<PopoverContent class="w-[var(--popover-trigger-width)] p-1" align="start">
			{#each sortOptions as option (option.value)}
				<button
					type="button"
					class="flex w-full items-center gap-2 px-2 py-1.5 text-xs transition-colors hover:bg-muted {sortOrder === option.value ? 'bg-muted' : ''}"
					onclick={() => {
						onsortchange(option.value);
						sortFilterOpen = false;
					}}
				>
					<span>{option.label}</span>
					{#if sortOrder === option.value}
						<svg class="ml-auto h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
						</svg>
					{/if}
				</button>
			{/each}
		</PopoverContent>
	</Popover>
</div>
