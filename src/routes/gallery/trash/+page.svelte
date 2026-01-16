<script lang="ts">
	import { Button, Badge, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "$lib/components/ui";
	import { SignedIn, SignedOut, SignInButton } from "svelte-clerk";
	import { useConvexClient, useQuery } from "convex-svelte";
	import { api } from "../../../convex/_generated/api.js";
	import type { Id } from "../../../convex/_generated/dataModel.js";
	import { goto } from "$app/navigation";
	import Navbar from "$lib/components/Navbar.svelte";

	const client = useConvexClient();

	// Query deleted posts
	const deletedQuery = useQuery(api.generatedPosts.listDeleted, () => ({}));

	let deletedPosts = $derived(deletedQuery.data ?? []);
	let isLoading = $derived(deletedQuery.isLoading);

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

	// Format relative time for deletion
	function formatDeletedAgo(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		
		if (days === 0) return "Hoje";
		if (days === 1) return "Ontem";
		if (days < 7) return `${days} dias atras`;
		if (days < 30) return `${Math.floor(days / 7)} semanas atras`;
		return `${Math.floor(days / 30)} meses atras`;
	}

	// Truncate caption
	function truncateCaption(caption: string, maxLength: number = 100): string {
		if (caption.length <= maxLength) return caption;
		return caption.substring(0, maxLength).trim() + '...';
	}

	// Restore a post
	async function handleRestore(postId: Id<"generated_posts">, event: Event) {
		event.stopPropagation();
		await client.mutation(api.generatedPosts.restore, { id: postId });
	}

	// Permanently delete a post
	async function handlePermanentDelete(postId: Id<"generated_posts">, event: Event) {
		event.stopPropagation();
		if (confirm("Tem certeza que deseja excluir permanentemente? Esta acao nao pode ser desfeita.")) {
			await client.mutation(api.generatedPosts.permanentDelete, { id: postId });
		}
	}

	// Empty trash (delete all)
	let isEmptyingTrash = $state(false);
	async function handleEmptyTrash() {
		if (deletedPosts.length === 0) return;
		if (!confirm(`Tem certeza que deseja excluir permanentemente ${deletedPosts.length} item(s)? Esta acao nao pode ser desfeita.`)) {
			return;
		}
		
		isEmptyingTrash = true;
		try {
			for (const post of deletedPosts) {
				await client.mutation(api.generatedPosts.permanentDelete, { id: post._id });
			}
		} finally {
			isEmptyingTrash = false;
		}
	}
</script>

<svelte:head>
	<title>Lixeira - Vanda Studio</title>
</svelte:head>

<div class="flex h-screen flex-col bg-background">
	<Navbar />

	<!-- Sub-header with actions -->
	<div class="shrink-0 border-b border-border bg-muted/30 px-4 py-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4">
				<div class="flex items-center gap-2">
					<svg class="h-5 w-5 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
					</svg>
					<span class="text-sm font-medium">Lixeira</span>
				</div>
				<span class="text-sm text-muted-foreground">
					{deletedPosts.length} item{deletedPosts.length !== 1 ? 's' : ''}
				</span>
			</div>
			<div class="flex items-center gap-2">
				{#if deletedPosts.length > 0}
					<Button 
						variant="destructive" 
						size="sm" 
						onclick={handleEmptyTrash}
						disabled={isEmptyingTrash}
					>
						{#if isEmptyingTrash}
							<svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
						{:else}
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
							</svg>
						{/if}
						Esvaziar Lixeira
					</Button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Main content -->
	<main class="flex-1 overflow-y-auto p-6">
		<SignedOut>
			<div class="flex flex-1 flex-col items-center justify-center gap-6 py-20">
				<div class="text-center">
					<h2 class="text-2xl font-bold">Entre para ver a lixeira</h2>
					<p class="mt-2 text-muted-foreground">
						Faca login para acessar seus itens excluidos
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
						<p class="text-sm text-muted-foreground">Carregando lixeira...</p>
					</div>
				</div>
			{:else if deletedPosts.length === 0}
				<div class="flex flex-col items-center justify-center py-20">
					<div class="flex h-20 w-20 items-center justify-center rounded-none border-2 border-dashed border-border bg-muted/50">
						<svg class="h-10 w-10 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
						</svg>
					</div>
					<h3 class="mt-6 text-lg font-medium">Lixeira vazia</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						Itens excluidos aparecerao aqui
					</p>
					<Button class="mt-6" onclick={() => goto('/gallery')}>
						Voltar para Galeria
					</Button>
				</div>
			{:else}
				<!-- Trash grid -->
				<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each deletedPosts as post (post._id)}
						<div class="group relative flex flex-col overflow-hidden border border-border bg-card opacity-75 hover:opacity-100 transition-opacity">
							<!-- Image -->
							<div class="relative aspect-square overflow-hidden bg-muted">
								{#if post.imageUrl}
									<img 
										src={post.imageUrl} 
										alt="Post excluido" 
										class="h-full w-full object-cover grayscale group-hover:grayscale-0 transition-all"
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
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger>
												<button
													type="button"
													aria-label="Restaurar"
													class="flex h-10 w-10 items-center justify-center bg-white/20 text-white backdrop-blur-sm hover:bg-green-500/50"
													onclick={(e) => handleRestore(post._id, e)}
												>
													<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
													</svg>
												</button>
											</TooltipTrigger>
											<TooltipContent>
												<p>Restaurar</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger>
												<button
													type="button"
													aria-label="Excluir permanentemente"
													class="flex h-10 w-10 items-center justify-center bg-white/20 text-white backdrop-blur-sm hover:bg-red-500/50"
													onclick={(e) => handlePermanentDelete(post._id, e)}
												>
													<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
													</svg>
												</button>
											</TooltipTrigger>
											<TooltipContent>
												<p>Excluir permanentemente</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>

								<!-- Deleted badge -->
								<div class="absolute top-2 left-2">
									<Badge variant="destructive" class="text-[10px]">
										Excluido
									</Badge>
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
								<p class="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
									{truncateCaption(post.caption, 80)}
								</p>
								<div class="mt-auto flex items-center justify-between pt-3">
									<span class="text-xs text-muted-foreground">
										Criado {formatDate(post.createdAt)}
									</span>
									{#if post.deletedAt}
										<span class="text-xs text-destructive">
											{formatDeletedAgo(post.deletedAt)}
										</span>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>

				<!-- Info banner -->
				<div class="mt-8 rounded-none border border-border bg-muted/50 p-4">
					<div class="flex items-start gap-3">
						<svg class="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
						</svg>
						<div>
							<p class="text-sm font-medium">Itens na lixeira</p>
							<p class="mt-1 text-sm text-muted-foreground">
								Os itens excluidos podem ser restaurados a qualquer momento. Use "Esvaziar Lixeira" para excluir permanentemente todos os itens.
							</p>
						</div>
					</div>
				</div>
			{/if}
		</SignedIn>
	</main>
</div>
