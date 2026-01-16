<script lang="ts">
	import { Button, Input, Badge, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "$lib/components/ui";
	import { SignedIn, SignedOut, SignInButton } from "svelte-clerk";
	import { useConvexClient, useQuery } from "convex-svelte";
	import { api } from "../../convex/_generated/api.js";
	import type { Id } from "../../convex/_generated/dataModel.js";
	import { goto } from "$app/navigation";
	import Navbar from "$lib/components/Navbar.svelte";

	const client = useConvexClient();

	// Search state
	let searchQuery = $state("");
	let searchInputEl: HTMLInputElement;

	// Detect platform for keyboard shortcut
	let isMac = $state(false);
	$effect(() => {
		isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
	});

	// Keyboard shortcut to focus search (Cmd+K on Mac, Ctrl+K on others)
	function handleKeydown(event: KeyboardEvent) {
		const modifier = isMac ? event.metaKey : event.ctrlKey;
		if (modifier && event.key === 'k') {
			event.preventDefault();
			searchInputEl?.focus();
			searchInputEl?.select();
		}
	}

	// Queries
	const postsQuery = useQuery(api.generatedPosts.listByUser, () => ({ limit: 50 }));
	const searchResultsQuery = useQuery(
		api.generatedPosts.search,
		() => searchQuery.trim() ? { query: searchQuery.trim(), limit: 20 } : "skip"
	);

	// Derived data
	let posts = $derived(searchQuery.trim() ? (searchResultsQuery.data ?? []) : (postsQuery.data ?? []));
	let isLoading = $derived(postsQuery.isLoading || (searchQuery.trim() && searchResultsQuery.isLoading));

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

	// Handle delete
	async function handleDelete(postId: Id<"generated_posts">, event: Event) {
		event.stopPropagation();
		await client.mutation(api.generatedPosts.softDelete, { id: postId });
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

	// Handle search
	function handleSearch(event: Event) {
		const input = event.target as HTMLInputElement;
		searchQuery = input.value;
	}

	// Clear search
	function clearSearch() {
		searchQuery = "";
	}
</script>

<svelte:head>
	<title>Galeria - Vanda Studio</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-screen flex-col bg-background">
	<Navbar />

	<!-- Sub-header with search and actions -->
	<div class="shrink-0 border-b border-border bg-muted/30 px-4 py-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4">
				<!-- Search -->
				<div class="relative">
					<input
						bind:this={searchInputEl}
						type="text"
						placeholder="Buscar por prompt..."
						class="flex h-9 w-72 rounded-md border border-input bg-transparent px-3 py-1 pl-9 pr-16 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
						value={searchQuery}
						oninput={handleSearch}
					/>
					<svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
					</svg>
					<!-- Keyboard shortcut hint -->
					<div class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
						{#if searchQuery}
							<button
								type="button"
								aria-label="Limpar busca"
								class="pointer-events-auto text-muted-foreground hover:text-foreground"
								onclick={clearSearch}
							>
								<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						{:else}
							<kbd class="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
								<span class="text-xs">{isMac ? '⌘' : 'Ctrl'}</span>K
							</kbd>
						{/if}
					</div>
				</div>
				<span class="text-sm text-muted-foreground">
					{#if searchQuery.trim()}
						{posts.length} resultado{posts.length !== 1 ? 's' : ''} para "{searchQuery}"
					{:else}
						{posts.length} geracao{posts.length !== 1 ? 'es' : ''}
					{/if}
				</span>
			</div>
			<div class="flex items-center gap-2">
				<Button variant="ghost" size="sm" onclick={() => goto('/gallery/trash')}>
					<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
					</svg>
					Lixeira
				</Button>
			</div>
		</div>
	</div>

	<!-- Main content -->
	<main class="flex-1 overflow-y-auto p-6">
		<SignedOut>
			<div class="flex flex-1 flex-col items-center justify-center gap-6 py-20">
				<div class="text-center">
					<h2 class="text-2xl font-bold">Entre para ver sua galeria</h2>
					<p class="mt-2 text-muted-foreground">
						Faca login para acessar suas gerações
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
				<div class="flex items-center justify-center py-20">
					<div class="flex flex-col items-center gap-4">
						<svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						<p class="text-sm text-muted-foreground">Carregando galeria...</p>
					</div>
				</div>
			{:else if posts.length === 0}
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
							Nenhuma geracao ainda
						{/if}
					</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						{#if searchQuery.trim()}
							Tente buscar por outros termos
						{:else}
							Crie seu primeiro post para comecar
						{/if}
					</p>
					{#if !searchQuery.trim()}
						<Button class="mt-6" onclick={() => goto('/posts/create')}>
							Criar Primeiro Post
						</Button>
					{/if}
				</div>
			{:else}
				<!-- Gallery grid -->
				<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each posts as post (post._id)}
						<div 
							class="group relative flex flex-col overflow-hidden border border-border bg-card transition-shadow hover:shadow-lg cursor-pointer"
							onclick={() => goto(`/posts/${post._id}`)}
							onkeydown={(e) => e.key === 'Enter' && goto(`/posts/${post._id}`)}
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
													onclick={(e) => handleDelete(post._id, e)}
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
		</SignedIn>
	</main>
</div>
