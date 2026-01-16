<script lang="ts">
	import { Button, Badge, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "$lib/components/ui";
	import { SignedIn, SignedOut, SignInButton } from "svelte-clerk";
	import { useConvexClient, useQuery } from "convex-svelte";
	import { api } from "../../../convex/_generated/api.js";
	import type { Id } from "../../../convex/_generated/dataModel.js";
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import Navbar from "$lib/components/Navbar.svelte";
	import { EditImageModal } from "$lib/components/studio";

	const client = useConvexClient();

	// Get postId from URL
	let postId = $derived($page.params.postId as Id<"generated_posts">);

	// Query post with all history
	const postQuery = useQuery(
		api.generatedPosts.getWithHistory,
		() => postId ? { id: postId } : "skip"
	);

	let post = $derived(postQuery.data);
	let isLoading = $derived(postQuery.isLoading);

	// Selected image state
	let selectedImageIndex = $state(0);
	let selectedImage = $derived(post?.images?.[selectedImageIndex] ?? null);

	// Edit modal state
	let editModalOpen = $state(false);
	let editModalImage = $state<typeof selectedImage>(null);

	function openEditModal(image: typeof selectedImage) {
		if (!image) return;
		editModalImage = image;
		editModalOpen = true;
	}

	function closeEditModal() {
		editModalOpen = false;
		editModalImage = null;
	}

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
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	// Copy feedback state
	let showCopiedFeedback = $state(false);

	function handleCopyCaption() {
		if (!post?.caption) return;
		navigator.clipboard.writeText(post.caption);
		showCopiedFeedback = true;
		setTimeout(() => {
			showCopiedFeedback = false;
		}, 2000);
	}

	// Download image
	async function handleDownloadImage() {
		if (!selectedImage?.url) return;
		
		try {
			const response = await fetch(selectedImage.url);
			const blob = await response.blob();
			
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			
			const modelName = selectedImage.model.split('/').pop() ?? 'image';
			const extension = blob.type.split('/').pop() ?? 'png';
			link.download = `vanda-${modelName}-${Date.now()}.${extension}`;
			
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error('Download failed:', err);
		}
	}

	// Delete post (soft delete)
	async function handleDelete() {
		if (!postId) return;
		await client.mutation(api.generatedPosts.softDelete, { id: postId });
		goto('/gallery');
	}

	// Extract hashtags
	let hashtags = $derived(
		post?.caption?.match(/#\w+/g) ?? []
	);
</script>

<svelte:head>
	<title>{post?.caption?.slice(0, 50) ?? 'Post'} - Vanda Studio</title>
</svelte:head>

<div class="flex h-screen flex-col bg-background">
	<Navbar />

	<!-- Main content -->
	<main class="flex-1 overflow-y-auto">
		<SignedOut>
			<div class="flex flex-1 flex-col items-center justify-center gap-6 py-20">
				<div class="text-center">
					<h2 class="text-2xl font-bold">Entre para ver este post</h2>
					<p class="mt-2 text-muted-foreground">
						Faca login para acessar seus posts
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
						<p class="text-sm text-muted-foreground">Carregando post...</p>
					</div>
				</div>
			{:else if !post}
				<div class="flex flex-col items-center justify-center py-20">
					<div class="flex h-20 w-20 items-center justify-center rounded-none border-2 border-dashed border-border bg-muted/50">
						<svg class="h-10 w-10 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
						</svg>
					</div>
					<h3 class="mt-6 text-lg font-medium">Post nao encontrado</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						Este post pode ter sido deletado ou voce nao tem acesso
					</p>
					<Button class="mt-6" onclick={() => goto('/gallery')}>
						Voltar para Galeria
					</Button>
				</div>
			{:else}
				<div class="mx-auto max-w-6xl p-6">
					<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
						<!-- Image Section -->
						<div class="space-y-4">
							<!-- Main Image -->
							<div class="relative overflow-hidden border border-border bg-muted">
								{#if selectedImage?.url}
									<img 
										src={selectedImage.url} 
										alt="Post gerado" 
										class="w-full object-contain"
										style="aspect-ratio: {selectedImage.width} / {selectedImage.height};"
									/>
									<!-- Model badge -->
									<div class="absolute bottom-3 left-3">
										<Badge variant="secondary" class="bg-black/60 text-white backdrop-blur-sm">
											{modelDisplayNames[selectedImage.model] ?? selectedImage.model.split("/").pop()}
										</Badge>
									</div>
								{:else if post.imageUrl}
									<img 
										src={post.imageUrl} 
										alt="Post gerado" 
										class="w-full object-contain"
									/>
								{:else}
									<div class="flex aspect-square items-center justify-center">
										<svg class="h-16 w-16 text-muted-foreground/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
										</svg>
									</div>
								{/if}
							</div>

							<!-- Thumbnail Strip (if multiple images) -->
							{#if post.images && post.images.length > 1}
								<div class="flex gap-2 overflow-x-auto pb-2">
									{#each post.images as image, index}
										<button
											type="button"
											class="group relative h-20 w-20 shrink-0 overflow-hidden border-2 transition-all {selectedImageIndex === index ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground'}"
											onclick={() => selectedImageIndex = index}
										>
											{#if image.url}
												<img 
													src={image.url} 
													alt="Variante {index + 1}" 
													class="h-full w-full object-cover"
												/>
											{:else}
												<div class="flex h-full w-full items-center justify-center bg-muted">
													<svg class="h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
													</svg>
												</div>
											{/if}
											<div class="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-center text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
												{modelDisplayNames[image.model] ?? image.model.split("/").pop()}
											</div>
										</button>
									{/each}
								</div>
							{/if}

							<!-- Image Actions -->
							<div class="flex gap-2">
								<Button variant="outline" size="sm" onclick={handleDownloadImage} disabled={!selectedImage?.url}>
									<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
									</svg>
									Baixar
								</Button>
								{#if selectedImage}
									<Button variant="outline" size="sm" onclick={() => openEditModal(selectedImage)}>
										<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
										</svg>
										Refinar
									</Button>
								{/if}
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger>
											<Button variant="outline" size="sm" class="text-destructive hover:bg-destructive/10" onclick={handleDelete}>
												<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
												</svg>
												Excluir
											</Button>
										</TooltipTrigger>
										<TooltipContent>
											<p>Mover para lixeira</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							</div>
						</div>

						<!-- Caption & Details Section -->
						<div class="space-y-6">
							<!-- Caption Card -->
							<div class="border border-border bg-card">
								<div class="flex items-center justify-between border-b border-border px-4 py-3">
									<h3 class="text-sm font-medium">Legenda</h3>
									<TooltipProvider>
										<Tooltip open={showCopiedFeedback}>
											<TooltipTrigger>
												<Button variant="ghost" size="sm" onclick={handleCopyCaption}>
													{#if showCopiedFeedback}
														<svg class="h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
														</svg>
														Copiado!
													{:else}
														<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
														</svg>
														Copiar
													{/if}
												</Button>
											</TooltipTrigger>
										</Tooltip>
									</TooltipProvider>
								</div>
								<div class="p-4">
									<p class="whitespace-pre-wrap text-sm leading-relaxed">{post.caption}</p>
								</div>
								
								<!-- Stats -->
								<div class="border-t border-border px-4 py-3">
									<div class="flex items-center gap-6 text-sm">
										<div class="flex items-center gap-2">
											<span class="text-muted-foreground">Caracteres:</span>
											<span class="font-mono">{post.caption.length}</span>
										</div>
										<div class="flex items-center gap-2">
											<span class="text-muted-foreground">Hashtags:</span>
											<span class="font-mono">{hashtags.length}</span>
										</div>
									</div>
									{#if hashtags.length > 0}
										<div class="mt-3 flex flex-wrap gap-1.5">
											{#each hashtags as tag}
												<Badge variant="outline" class="text-xs">{tag}</Badge>
											{/each}
										</div>
									{/if}
								</div>
							</div>

							<!-- Metadata Card -->
							<div class="border border-border bg-card">
								<div class="border-b border-border px-4 py-3">
									<h3 class="text-sm font-medium">Detalhes</h3>
								</div>
								<div class="divide-y divide-border">
									<div class="flex items-center justify-between px-4 py-3">
										<span class="text-sm text-muted-foreground">Criado em</span>
										<span class="text-sm">{formatDate(post.createdAt)}</span>
									</div>
									{#if post.imageModel}
										<div class="flex items-center justify-between px-4 py-3">
											<span class="text-sm text-muted-foreground">Modelo de imagem</span>
											<Badge variant="secondary">
												{modelDisplayNames[post.imageModel] ?? post.imageModel.split("/").pop()}
											</Badge>
										</div>
									{/if}
									{#if post.model}
										<div class="flex items-center justify-between px-4 py-3">
											<span class="text-sm text-muted-foreground">Modelo de texto</span>
											<span class="text-sm">{post.model}</span>
										</div>
									{/if}
									{#if post.images && post.images.length > 0}
										<div class="flex items-center justify-between px-4 py-3">
											<span class="text-sm text-muted-foreground">Imagens geradas</span>
											<span class="text-sm">{post.images.length}</span>
										</div>
									{/if}
									{#if selectedImage}
										<div class="flex items-center justify-between px-4 py-3">
											<span class="text-sm text-muted-foreground">Dimensoes</span>
											<span class="text-sm font-mono">{selectedImage.width}x{selectedImage.height}</span>
										</div>
									{/if}
								</div>
							</div>

							<!-- Chat History Card (if exists) -->
							{#if post.messages && post.messages.length > 0}
								<div class="border border-border bg-card">
									<div class="border-b border-border px-4 py-3">
										<h3 class="text-sm font-medium">Historico de Geracao</h3>
									</div>
									<div class="max-h-64 divide-y divide-border overflow-y-auto">
										{#each post.messages as message}
											<div class="px-4 py-3">
												<div class="flex items-center gap-2">
													<Badge variant={message.role === 'user' ? 'default' : 'secondary'} class="text-xs">
														{message.role === 'user' ? 'Voce' : 'IA'}
													</Badge>
													<span class="text-xs text-muted-foreground">
														{formatDate(message.createdAt)}
													</span>
												</div>
												<p class="mt-2 text-sm line-clamp-3">{message.content}</p>
											</div>
										{/each}
									</div>
								</div>
							{/if}

							<!-- Actions -->
							<div class="flex gap-2">
								<Button variant="outline" class="flex-1" onclick={() => goto('/posts/create')}>
									Criar Novo Post
								</Button>
								<Button class="flex-1" onclick={() => goto('/gallery')}>
									Ver Galeria
								</Button>
							</div>
						</div>
					</div>
				</div>
			{/if}
		</SignedIn>
	</main>
</div>

<!-- Edit Image Modal -->
{#if editModalImage}
	<EditImageModal 
		image={editModalImage}
		open={editModalOpen}
		onclose={closeEditModal}
	/>
{/if}
