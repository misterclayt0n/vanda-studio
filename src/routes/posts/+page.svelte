<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import { onMount } from "svelte";
	import Navbar from "$lib/components/Navbar.svelte";
	import { PostComposerWorkspace } from "$lib/components/posts";
	import PostListItem from "$lib/components/posts/PostListItem.svelte";
	import { Button, Input, Popover, PopoverTrigger, PopoverContent } from "$lib/components/ui";
	import {
		loadPostsPageState,
		savePostsPageState,
		type PostsPageFilterStatus,
		type PostsPagePlatform,
	} from "$lib/studio/postsPageState";
	import { SignedIn, SignedOut, SignInButton } from "svelte-clerk";
	import { api } from "../../convex/_generated/api.js";
	import type { Id } from "../../convex/_generated/dataModel.js";
	import { useConvexClient, useQuery } from "convex-svelte";

	type PlatformId = PostsPagePlatform;

	type PostCard = {
		_id: Id<"generated_posts">;
		caption: string;
		title?: string;
		platform: string;
		status: string;
		createdAt: number;
		updatedAt: number;
		projectId?: Id<"projects">;
		projectName?: string;
		scheduledFor?: number;
		schedulingStatus?: string;
		mediaCount: number;
		coverUrl: string | null;
		coverThumbnailUrl?: string | null;
		mediaPreview: Array<{
			mediaItemId: Id<"media_items">;
			url: string | null;
			thumbnailUrl?: string | null;
			mimeType: string;
		}>;
	};

	const LG_BREAKPOINT = 1024;
	const postsQuery = useQuery(api.generatedPosts.listCardsByUser, { limit: 80 });
	const projectsQuery = useQuery(api.projects.list, {});

	let searchQuery = $state("");
	let debouncedSearchQuery = $state("");
	let activeSearchQuery = $derived(
		searchQuery.trim() && debouncedSearchQuery === searchQuery.trim() ? debouncedSearchQuery : ""
	);
	let filterProjectId = $state("");
	let filterStatus = $state<PostsPageFilterStatus>("all");
	let restoredState = $state(false);
	let sidebarOpen = $state(true);
	let projectFilterOpen = $state(false);
	let statusFilterOpen = $state(false);

	const platformTabs: Array<{
		id: PlatformId;
		label: string;
		enabled: boolean;
	}> = [
		{ id: "instagram", label: "Instagram", enabled: true },
		{ id: "twitter", label: "X", enabled: false },
		{ id: "linkedin", label: "LinkedIn", enabled: false },
	];

	function normalizePlatform(value: string | null): PlatformId {
		if (value === "twitter" || value === "linkedin" || value === "instagram") {
			return value;
		}
		return "instagram";
	}

	const platform = $derived(normalizePlatform($page.url.searchParams.get("platform")));
	const selectedPostId = $derived(
		$page.url.searchParams.get("postId") as Id<"generated_posts"> | null
	);
	const composerInstanceKey = $derived(
		[
			selectedPostId ?? "new",
			$page.url.searchParams.get("projectId") ?? "",
			$page.url.searchParams.get("mediaIds") ?? "",
		].join(":")
	);
	const postsSearchQuery = useQuery(
		api.generatedPosts.searchCards,
		() =>
			activeSearchQuery
				? {
					query: activeSearchQuery,
					limit: 40,
					platform,
					...(filterProjectId ? { projectId: filterProjectId as Id<"projects"> } : {}),
					...(filterStatus !== "all" ? { schedulingStatus: filterStatus } : {}),
				}
				: "skip"
	);

	let projects = $derived(projectsQuery.data ?? []);
	let posts = $derived((postsQuery.data ?? []) as PostCard[]);
	let searchResults = $derived((postsSearchQuery.data ?? []) as PostCard[]);

	onMount(() => {
		const savedState = loadPostsPageState();
		if (savedState) {
			searchQuery = savedState.searchQuery;
			filterProjectId = savedState.filterProjectId ?? "";
			filterStatus = savedState.filterStatus;

			const url = new URL(window.location.href);
			let shouldRestoreUrl = false;

			if (!url.searchParams.has("platform") && savedState.platform !== "instagram") {
				url.searchParams.set("platform", savedState.platform);
				shouldRestoreUrl = true;
			}

			if (
				!url.searchParams.has("postId") &&
				!url.searchParams.has("projectId") &&
				!url.searchParams.has("mediaIds") &&
				savedState.platform === "instagram" &&
				savedState.selectedPostId
			) {
				url.searchParams.set("postId", savedState.selectedPostId);
				shouldRestoreUrl = true;
			}

			if (shouldRestoreUrl) {
				void goto(url.toString(), { replaceState: true, noScroll: true });
			}
		}

		restoredState = true;
		sidebarOpen = window.innerWidth >= LG_BREAKPOINT;
	});

	$effect(() => {
		if (!restoredState) return;

		savePostsPageState({
			searchQuery,
			filterProjectId: filterProjectId || null,
			filterStatus,
			platform,
			selectedPostId,
		});
	});

	$effect(() => {
		const timeout = setTimeout(() => {
			debouncedSearchQuery = searchQuery.trim();
		}, 200);

		return () => clearTimeout(timeout);
	});

	let filteredPosts = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();

		if (activeSearchQuery) {
			return searchResults;
		}

		return posts.filter((post) => {
			if (platform !== "instagram" && post.platform !== platform) {
				return false;
			}
			if (filterProjectId && post.projectId !== filterProjectId) {
				return false;
			}
			if (filterStatus === "scheduled" && post.schedulingStatus !== "scheduled") {
				return false;
			}
			if (filterStatus === "draft" && post.schedulingStatus === "scheduled") {
				return false;
			}
			if (!query) {
				return true;
			}

			return (
				(post.title?.toLowerCase().includes(query) ?? false) ||
				post.caption.toLowerCase().includes(query) ||
				(post.projectName?.toLowerCase().includes(query) ?? false)
			);
		});
	});

	let isPostListLoading = $derived(
		postsQuery.isLoading ||
		(!!activeSearchQuery && postsSearchQuery.isLoading)
	);

	function updateUrl(mutator: (url: URL) => void) {
		const url = new URL($page.url);
		mutator(url);
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function setPlatform(next: PlatformId) {
		if (next === platform) return;

		updateUrl((url) => {
			if (next === "instagram") {
				url.searchParams.delete("platform");
			} else {
				url.searchParams.set("platform", next);
				url.searchParams.delete("postId");
				url.searchParams.delete("projectId");
				url.searchParams.delete("mediaIds");
			}
		});
	}

	function selectPost(postId: Id<"generated_posts">) {
		updateUrl((url) => {
			url.searchParams.set("postId", postId);
		});
	}

	function startNewPost() {
		updateUrl((url) => {
			url.searchParams.delete("postId");
			url.searchParams.delete("projectId");
			url.searchParams.delete("mediaIds");
			if (platform !== "instagram") {
				url.searchParams.delete("platform");
			}
		});
	}

	const client = useConvexClient();

	let selectedIds = $state(new Set<Id<"generated_posts">>());
	let selectionMode = $state(false);
	let confirmDeleteIds = $state<Id<"generated_posts">[]>([]);
	let isDeletingBulk = $state(false);

	function toggleSelectionMode() {
		selectionMode = !selectionMode;
		if (!selectionMode) selectedIds = new Set();
	}

	function toggleSelect(id: Id<"generated_posts">) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function promptDelete(ids: Id<"generated_posts">[]) {
		confirmDeleteIds = ids;
	}

	async function confirmDelete() {
		if (confirmDeleteIds.length === 0) return;
		isDeletingBulk = true;
		try {
			await Promise.all(
				confirmDeleteIds.map((id) =>
					client.mutation(api.generatedPosts.softDelete, { id })
				)
			);
			// If the currently open post was deleted, clear it
			if (selectedPostId && confirmDeleteIds.includes(selectedPostId)) {
				startNewPost();
			}
			selectedIds = new Set();
			selectionMode = false;
		} finally {
			isDeletingBulk = false;
			confirmDeleteIds = [];
		}
	}
</script>

<svelte:head>
	<title>Posts - Vanda Studio</title>
</svelte:head>

<div class="flex h-screen flex-col bg-background">
	<Navbar />

	<SignedOut>
		<div class="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-20">
			<div class="max-w-md text-center">
				<h2 class="text-2xl font-semibold">Entre para ver seus posts</h2>
				<p class="mt-2 text-sm text-muted-foreground">
					Monte, revise e agende seus rascunhos do Instagram em um só lugar.
				</p>
			</div>
			<SignInButton mode="modal">
				<button
					class="h-10 rounded-none bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
				>
					Entrar
				</button>
			</SignInButton>
		</div>
	</SignedOut>

	<SignedIn>
		<div class="flex min-h-0 flex-1 overflow-hidden">
			{#if platform !== "instagram"}
				<!-- Coming soon for other platforms -->
				<aside class="shrink-0 border-r border-border bg-muted/20" style="width: 20rem;">
					<div class="space-y-6 p-4">
						<div class="space-y-3">
							<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
								Plataforma
							</p>
							<div class="flex gap-2">
								{#each platformTabs as tab}
									<button
										type="button"
										class="relative flex h-11 w-11 items-center justify-center border transition {platform ===
										tab.id
											? 'border-primary bg-primary/10 text-foreground shadow-[0_0_0_1px] shadow-primary/20'
											: tab.enabled
												? 'border-border bg-card/60 text-muted-foreground hover:border-primary/30 hover:text-foreground'
												: 'cursor-not-allowed border-border bg-card/40 text-muted-foreground/55'}"
										aria-label={tab.label}
										title={tab.enabled ? tab.label : `${tab.label} em breve`}
										onclick={() => tab.enabled && setPlatform(tab.id)}
										disabled={!tab.enabled}
									>
										{#if tab.id === "instagram"}
											<svg
												class="h-5 w-5"
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
												stroke-width="1.8"
												stroke="currentColor"
											>
												<rect x="3.5" y="3.5" width="17" height="17" rx="5"></rect>
												<circle cx="12" cy="12" r="4.2"></circle>
												<circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"
												></circle>
											</svg>
										{:else if tab.id === "twitter"}
											<svg
												class="h-5 w-5"
												xmlns="http://www.w3.org/2000/svg"
												viewBox="0 0 24 24"
												fill="currentColor"
											>
												<path
													d="M18.244 2H21l-6.016 6.874L22 22h-5.828l-4.563-5.966L6.39 22H3.632l6.437-7.356L2 2h5.976l4.124 5.445L18.244 2zm-.967 18h1.527L7.146 3.895H5.51L17.277 20z"
												/>
											</svg>
										{:else}
											<svg
												class="h-5 w-5"
												xmlns="http://www.w3.org/2000/svg"
												viewBox="0 0 24 24"
												fill="currentColor"
											>
												<path
													d="M19 3A2 2 0 0 1 21 5V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V5A2 2 0 0 1 5 3H19ZM8.339 10.339H5.667V18H8.34V10.339ZM7.003 6A1.56 1.56 0 1 0 7.04 9.12 1.56 1.56 0 0 0 7.003 6ZM18.333 13.32C18.333 10.96 16.891 9.86 15.135 9.86C13.717 9.86 13.084 10.64 12.73 11.19V10.339H10.06C10.095 10.903 10.06 18 10.06 18H12.73V13.72C12.73 13.49 12.746 13.26 12.814 13.094C12.998 12.635 13.417 12.16 14.115 12.16C15.03 12.16 15.397 12.856 15.397 13.877V18H18.333V13.32Z"
												/>
											</svg>
										{/if}
										{#if platform === tab.id}
											<span
												class="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary"
											></span>
										{/if}
									</button>
								{/each}
							</div>
						</div>
					</div>
				</aside>

				<div class="flex flex-1 items-center justify-center px-8 py-12">
					<div class="max-w-xl border border-border bg-card/70 p-10 text-center">
						<p class="text-xs font-semibold uppercase tracking-[0.22em] text-primary/70">
							Roadmap
						</p>
						<h2 class="mt-3 text-3xl font-semibold">
							{platform === "twitter" ? "X" : "LinkedIn"} entra no próximo ciclo
						</h2>
						<p class="mt-4 text-sm leading-7 text-muted-foreground">
							A biblioteca e a composição continuam ativas apenas para Instagram por enquanto.
						</p>
					</div>
				</div>
			{:else}
				<!-- Left list panel -->
				<aside
					class="shrink-0 flex flex-col overflow-hidden transition-[width] duration-300 ease-in-out {sidebarOpen
						? 'border-r border-border bg-muted/20'
						: ''}"
					style="width: {sidebarOpen ? '340px' : '0px'}"
				>
					{#if sidebarOpen}
					<!-- Panel header -->
					<div
						class="shrink-0 flex items-center justify-between border-b border-border px-3 py-3"
					>
						<div class="flex items-center gap-1.5">
							{#each platformTabs as tab}
								<button
									type="button"
									class="relative flex h-8 w-8 items-center justify-center border transition {platform ===
									tab.id
										? 'border-primary bg-primary/10 text-foreground'
										: tab.enabled
											? 'border-border bg-card/60 text-muted-foreground hover:border-primary/30 hover:text-foreground'
											: 'cursor-not-allowed border-border bg-card/40 text-muted-foreground/55'}"
									aria-label={tab.label}
									title={tab.enabled ? tab.label : `${tab.label} em breve`}
									onclick={() => tab.enabled && setPlatform(tab.id)}
									disabled={!tab.enabled}
								>
									{#if tab.id === "instagram"}
										<svg
											class="h-4 w-4"
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											stroke-width="1.8"
											stroke="currentColor"
										>
											<rect x="3.5" y="3.5" width="17" height="17" rx="5"></rect>
											<circle cx="12" cy="12" r="4.2"></circle>
											<circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"
											></circle>
										</svg>
									{:else if tab.id === "twitter"}
										<svg
											class="h-4 w-4"
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 24 24"
											fill="currentColor"
										>
											<path
												d="M18.244 2H21l-6.016 6.874L22 22h-5.828l-4.563-5.966L6.39 22H3.632l6.437-7.356L2 2h5.976l4.124 5.445L18.244 2zm-.967 18h1.527L7.146 3.895H5.51L17.277 20z"
											/>
										</svg>
									{:else}
										<svg
											class="h-4 w-4"
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 24 24"
											fill="currentColor"
										>
											<path
												d="M19 3A2 2 0 0 1 21 5V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V5A2 2 0 0 1 5 3H19ZM8.339 10.339H5.667V18H8.34V10.339ZM7.003 6A1.56 1.56 0 1 0 7.04 9.12 1.56 1.56 0 0 0 7.003 6ZM18.333 13.32C18.333 10.96 16.891 9.86 15.135 9.86C13.717 9.86 13.084 10.64 12.73 11.19V10.339H10.06C10.095 10.903 10.06 18 10.06 18H12.73V13.72C12.73 13.49 12.746 13.26 12.814 13.094C12.998 12.635 13.417 12.16 14.115 12.16C15.03 12.16 15.397 12.856 15.397 13.877V18H18.333V13.32Z"
											/>
										</svg>
									{/if}
									{#if platform === tab.id}
										<span
											class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary"
										></span>
									{/if}
								</button>
							{/each}
						</div>

						<Button
							variant="ghost"
							size="sm"
							class="h-8 gap-1.5 px-2.5 text-xs"
							onclick={startNewPost}
						>
								<svg
									class="h-3.5 w-3.5"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.8"
									stroke="currentColor"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
								</svg>
								Novo
						</Button>
					</div>

					<!-- Search + filters -->
					<div class="shrink-0 space-y-2 border-b border-border px-3 py-3">
						<div class="relative">
							<Input
								value={searchQuery}
								oninput={(event) =>
									(searchQuery = (event.currentTarget as HTMLInputElement).value)}
								placeholder="Buscar posts..."
								class="h-8 pl-8 text-xs"
							/>
							<svg
								class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
								/>
							</svg>
						</div>

						<div class="flex gap-2">
							<!-- Project filter -->
							<Popover bind:open={projectFilterOpen}>
								<PopoverTrigger class="flex-1">
									<button
										type="button"
										class="flex h-8 w-full items-center justify-between border border-border bg-background px-2 text-xs transition-colors hover:bg-muted {projectFilterOpen ? 'ring-1 ring-ring' : ''}"
									>
										<div class="flex min-w-0 items-center gap-1.5">
											{#if filterProjectId}
												{@const proj = projects.find(p => p._id === filterProjectId)}
												{#if proj}
													<div class="h-4 w-4 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
														{#if proj.profilePictureStorageUrl ?? proj.profilePictureUrl}
															<img src={proj.profilePictureStorageUrl ?? proj.profilePictureUrl} alt="" class="h-full w-full object-cover" />
														{:else}
															<span class="flex h-full w-full items-center justify-center text-[8px] font-bold text-muted-foreground">{proj.name[0]?.toUpperCase()}</span>
														{/if}
													</div>
													<span class="truncate">{proj.name}</span>
												{/if}
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
										class="flex w-full items-center gap-2 px-2 py-1.5 text-xs transition-colors hover:bg-muted {filterProjectId === '' ? 'bg-muted' : ''}"
										onclick={() => { filterProjectId = ''; projectFilterOpen = false; }}
									>
										<span class="text-muted-foreground">Todos os projetos</span>
										{#if filterProjectId === ''}
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
											class="flex w-full items-center gap-2 px-2 py-1.5 text-xs transition-colors hover:bg-muted {filterProjectId === project._id ? 'bg-muted' : ''}"
											onclick={() => { filterProjectId = project._id; projectFilterOpen = false; }}
										>
											<div class="h-4 w-4 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
												{#if project.profilePictureStorageUrl ?? project.profilePictureUrl}
													<img src={project.profilePictureStorageUrl ?? project.profilePictureUrl} alt="" class="h-full w-full object-cover" />
												{:else}
													<span class="flex h-full w-full items-center justify-center text-[8px] font-bold text-muted-foreground">{project.name[0]?.toUpperCase()}</span>
												{/if}
											</div>
											<span class="truncate">{project.name}</span>
											{#if filterProjectId === project._id}
												<svg class="ml-auto h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
												</svg>
											{/if}
										</button>
									{/each}
								</PopoverContent>
							</Popover>

							<!-- Status filter -->
							<Popover bind:open={statusFilterOpen}>
								<PopoverTrigger>
									<button
										type="button"
										class="flex h-8 w-full items-center justify-between border border-border bg-background px-2 text-xs transition-colors hover:bg-muted {statusFilterOpen ? 'ring-1 ring-ring' : ''}"
									>
										<span class="{filterStatus === 'all' ? 'text-muted-foreground' : ''}">
											{filterStatus === 'all' ? 'Todos' : filterStatus === 'draft' ? 'Rascunhos' : 'Agendados'}
										</span>
										<svg class="h-3 w-3 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
										</svg>
									</button>
								</PopoverTrigger>
								<PopoverContent class="w-28 p-1" align="end">
									{#each [['all', 'Todos'], ['draft', 'Rascunhos'], ['scheduled', 'Agendados']] as [val, label] (val)}
										<button
											type="button"
											class="flex w-full items-center gap-2 px-2 py-1.5 text-xs transition-colors hover:bg-muted {filterStatus === val ? 'bg-muted' : ''}"
											onclick={() => { filterStatus = val as typeof filterStatus; statusFilterOpen = false; }}
										>
											{label}
											{#if filterStatus === val}
												<svg class="ml-auto h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
												</svg>
											{/if}
										</button>
									{/each}
								</PopoverContent>
							</Popover>

							<!-- Selection toggle -->
							<button
								type="button"
								class="flex h-8 w-8 shrink-0 items-center justify-center border border-border bg-background transition-colors hover:bg-muted {selectionMode ? 'border-primary text-primary' : 'text-muted-foreground'}"
								onclick={toggleSelectionMode}
								title={selectionMode ? "Cancelar seleção" : "Selecionar posts"}
							>
								<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</button>
						</div>

						<p class="text-[11px] text-muted-foreground/70">
							{filteredPosts.length}
							{filteredPosts.length === 1 ? "post" : "posts"}
						</p>
					</div>

					<!-- Post list -->
					<div class="min-h-0 flex-1 overflow-y-auto">
						{#if isPostListLoading}
							<div class="flex items-center justify-center py-10">
								<svg
									class="h-5 w-5 animate-spin text-primary"
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
						{:else if filteredPosts.length === 0}
							<div class="flex flex-col items-center gap-2 px-4 py-10 text-center">
								<svg
									class="h-8 w-8 text-muted-foreground/30"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M4.75 4.75h5.5v5.5h-5.5zm9 0h5.5v5.5h-5.5zm-9 9h5.5v5.5h-5.5zm9 0h5.5v5.5h-5.5z"
									/>
								</svg>
								<p class="text-xs text-muted-foreground">
									{searchQuery.trim() ? "Nenhum resultado" : "Nenhum post ainda"}
								</p>
							</div>
						{:else}
							{#each filteredPosts as post (post._id)}
								<PostListItem
									{post}
									selected={post._id === selectedPostId}
									{selectionMode}
									checked={selectedIds.has(post._id)}
									onclick={() => selectPost(post._id)}
									ontoggleselect={() => toggleSelect(post._id)}
									ondelete={() => promptDelete([post._id])}
								/>
							{/each}
						{/if}
					</div>
					<!-- Bulk action bar -->
					{#if selectionMode}
						<div class="shrink-0 flex items-center justify-between gap-2 border-t border-border bg-background px-3 py-2">
							<span class="text-xs text-muted-foreground">
								{selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}
							</span>
							<Button
								variant="ghost"
								size="sm"
								class="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
								disabled={selectedIds.size === 0}
								onclick={() => promptDelete([...selectedIds])}
							>
								Excluir selecionados
							</Button>
						</div>
					{/if}
					{/if}
				</aside>

				<!-- Main composer area -->
				<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
					<!-- Thin header with sidebar toggle -->
					<div
						class="shrink-0 flex items-center border-b border-border bg-muted/20 px-2 py-2"
					>
						<Button
							variant="ghost"
							size="icon"
							class="h-8 w-8"
							onclick={() => (sidebarOpen = !sidebarOpen)}
							aria-label={sidebarOpen ? "Fechar painel lateral" : "Abrir painel lateral"}
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
									d="M3.75 3.75h16.5v16.5H3.75V3.75z"
								/>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M9.75 3.75v16.5"
								/>
							</svg>
						</Button>
					</div>

					<!-- Workspace -->
					<div class="min-h-0 flex-1 flex flex-col overflow-hidden">
						{#key composerInstanceKey}
							<PostComposerWorkspace
								postId={selectedPostId}
								showToolbar={false}
								ondelete={startNewPost}
							/>
						{/key}
					</div>
				</div>
			{/if}
		</div>
	</SignedIn>
</div>

<!-- Confirm delete dialog -->
{#if confirmDeleteIds.length > 0}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
		<div class="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-2xl">
			<h2 class="text-base font-semibold">Excluir {confirmDeleteIds.length === 1 ? "post" : `${confirmDeleteIds.length} posts`}?</h2>
			<p class="mt-1.5 text-sm text-muted-foreground">
				{confirmDeleteIds.length === 1
					? "Este post será excluído permanentemente."
					: `${confirmDeleteIds.length} posts serão excluídos permanentemente.`}
				Esta ação não pode ser desfeita.
			</p>
			<div class="mt-5 flex justify-end gap-2">
				<Button
					variant="ghost"
					size="sm"
					onclick={() => (confirmDeleteIds = [])}
					disabled={isDeletingBulk}
				>
					Cancelar
				</Button>
				<Button
					variant="destructive"
					size="sm"
					onclick={confirmDelete}
					disabled={isDeletingBulk}
				>
					{isDeletingBulk ? "Excluindo..." : "Excluir"}
				</Button>
			</div>
		</div>
	</div>
{/if}
