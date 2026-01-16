<script lang="ts">
	import { Button, Textarea, Label, Badge, Separator, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "$lib/components/ui";
	import { ImageModelSelector, ImageSkeleton } from "$lib/components/studio";
	import { SignedIn, SignedOut, SignInButton, UserButton } from "svelte-clerk";
	import { useConvexClient, useQuery } from "convex-svelte";
	import { api } from "../../../../convex/_generated/api.js";
	import type { Id } from "../../../../convex/_generated/dataModel.js";
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import Logo from "$lib/components/Logo.svelte";

	// Convex client
	const client = useConvexClient();

	// Get conversation ID from URL
	let conversationId = $derived($page.params.conversationId as Id<"image_edit_conversations">);

	// Subscriptions
	const conversationQuery = useQuery(
		api.imageEditConversations.get,
		() => conversationId ? { id: conversationId } : "skip"
	);

	const turnsQuery = useQuery(
		api.imageEditTurns.listByConversation,
		() => conversationId ? { conversationId } : "skip"
	);

	const allOutputsQuery = useQuery(
		api.imageEditOutputs.listByConversation,
		() => conversationId ? { conversationId } : "skip"
	);

	// Derived states
	let conversation = $derived(conversationQuery.data);
	let turns = $derived(turnsQuery.data ?? []);
	let allOutputs = $derived(allOutputsQuery.data ?? []);
	let turnCount = $derived(turns.length);
	let isLoading = $derived(!conversation && conversationQuery.isLoading);

	// Form state for new edit
	let editPrompt = $state("");
	let selectedModels = $state<string[]>(["google/gemini-3-pro-image-preview"]);
	let referenceImages = $state<Array<{ id: string; url: string; name: string; file: File }>>([]);
	let isSending = $state(false);
	let fileInputEl: HTMLInputElement;

	// Model display names
	const modelDisplayNames: Record<string, string> = {
		"google/gemini-2.5-flash-image": "Nano Banana",
		"google/gemini-3-pro-image-preview": "Nano Banana Pro",
		"bytedance-seed/seedream-4.5": "SeeDream v4.5",
		"black-forest-labs/flux.2-flex": "Flux 2 Flex",
		"openai/gpt-5-image": "GPT Image 1.5",
	};

	// Add image files to references
	function addImageFiles(files: File[]) {
		files.forEach((file) => {
			if (!file.type.startsWith('image/')) return;
			const url = URL.createObjectURL(file);
			referenceImages = [...referenceImages, {
				id: crypto.randomUUID(),
				url,
				name: file.name || `pasted-image-${Date.now()}.png`,
				file
			}];
		});
	}

	// Handle file selection for additional references
	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files) return;
		
		addImageFiles(Array.from(input.files));
		
		input.value = "";
	}

	// Handle paste from clipboard
	function handlePaste(event: ClipboardEvent) {
		const items = event.clipboardData?.items;
		if (!items) return;

		const imageFiles: File[] = [];
		for (const item of items) {
			if (item.type.startsWith('image/')) {
				const file = item.getAsFile();
				if (file) {
					imageFiles.push(file);
				}
			}
		}

		if (imageFiles.length > 0) {
			event.preventDefault();
			addImageFiles(imageFiles);
		}
	}

	function removeReference(id: string) {
		const img = referenceImages.find(r => r.id === id);
		if (img) {
			URL.revokeObjectURL(img.url);
		}
		referenceImages = referenceImages.filter(r => r.id !== id);
	}

	// Upload a file to Convex storage
	async function uploadFileToStorage(file: File): Promise<Id<"_storage">> {
		const uploadUrl = await client.mutation(api.referenceImages.generateUploadUrl, {});
		
		const response = await fetch(uploadUrl, {
			method: "POST",
			headers: { "Content-Type": file.type },
			body: file,
		});
		
		if (!response.ok) {
			throw new Error("Falha ao fazer upload da imagem");
		}
		
		const { storageId } = await response.json();
		return storageId as Id<"_storage">;
	}

	// Send new edit
	async function handleSendEdit() {
		if (!editPrompt.trim() || selectedModels.length === 0) return;

		isSending = true;

		try {
			// Upload manual reference images if any
			let manualReferenceIds: Id<"_storage">[] = [];
			if (referenceImages.length > 0) {
				const uploadPromises = referenceImages.map(img => uploadFileToStorage(img.file));
				manualReferenceIds = await Promise.all(uploadPromises);
			}

			await client.action(api.ai.imageEdit.sendEdit, {
				conversationId,
				userMessage: editPrompt,
				selectedModels,
				...(manualReferenceIds.length > 0 && { manualReferenceIds }),
			});

			// Clear form
			editPrompt = "";
			referenceImages.forEach(img => URL.revokeObjectURL(img.url));
			referenceImages = [];
		} catch (err) {
			console.error("Failed to send edit:", err);
		} finally {
			isSending = false;
		}
	}

	// Handle keyboard shortcuts
	function handleKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
			handleSendEdit();
		}
	}

	// Check if any turn is still generating
	let isAnyGenerating = $derived(turns.some(t => t.status === "generating" || (t.pendingModels && t.pendingModels.length > 0)));

	// Download image
	async function downloadImage(url: string, model: string) {
		try {
			const response = await fetch(url);
			const blob = await response.blob();
			
			const downloadUrl = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = downloadUrl;
			
			const modelName = model.split('/').pop() ?? 'image';
			const extension = blob.type.split('/').pop() ?? 'png';
			link.download = `vanda-edit-${modelName}-${Date.now()}.${extension}`;
			
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			
			URL.revokeObjectURL(downloadUrl);
		} catch (err) {
			console.error('Download failed:', err);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>{conversation?.title ?? 'Editar Imagem'} - Vanda Studio</title>
</svelte:head>

<div class="flex h-screen flex-col bg-background">
	<!-- Header -->
	<header class="shrink-0 border-b border-border">
		<div class="flex h-14 items-center justify-between px-4">
			<div class="flex items-center gap-4">
				<a href="/">
					<Logo />
				</a>
				<Separator orientation="vertical" class="h-6" />
				<button
					type="button"
					class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
					onclick={() => goto('/posts/create')}
				>
					<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
					</svg>
					Voltar
				</button>
				<Separator orientation="vertical" class="h-6" />
				<div class="flex items-center gap-2">
					<span class="text-sm font-medium">{conversation?.title ?? 'Carregando...'}</span>
					{#if turnCount > 0}
						<Badge variant="secondary">{turnCount} {turnCount === 1 ? 'edicao' : 'edicoes'}</Badge>
					{/if}
				</div>
			</div>

			<div class="flex items-center gap-4">
				<SignedOut>
					<SignInButton mode="modal">
						<button
							class="h-8 rounded-none border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
						>
							Entrar
						</button>
					</SignInButton>
				</SignedOut>
				<SignedIn>
					<UserButton />
				</SignedIn>
			</div>
		</div>
	</header>

	<!-- Main content -->
	<div class="flex min-h-0 flex-1">
		{#if isLoading}
			<div class="flex flex-1 items-center justify-center">
				<div class="flex flex-col items-center gap-4">
					<svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					<p class="text-sm text-muted-foreground">Carregando conversa...</p>
				</div>
			</div>
		{:else if !conversation}
			<div class="flex flex-1 items-center justify-center">
				<div class="flex flex-col items-center gap-4">
					<div class="flex h-16 w-16 items-center justify-center rounded-none border-2 border-destructive/50 bg-destructive/10">
						<svg class="h-8 w-8 text-destructive" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
						</svg>
					</div>
					<p class="text-sm text-muted-foreground">Conversa nao encontrada</p>
					<Button variant="outline" onclick={() => goto('/posts/create')}>
						Voltar para criacao
					</Button>
				</div>
			</div>
		{:else}
			<!-- Conversation content -->
			<div class="flex flex-1 flex-col overflow-hidden">
				<!-- Thumbnail strip -->
				{#if allOutputs.length > 0}
					<div class="shrink-0 border-b border-border bg-muted/30 p-4">
						<div class="flex gap-2 overflow-x-auto pb-2">
							<!-- Source image -->
							{#if conversation.sourceImageUrl}
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger>
											<div class="relative h-16 w-16 shrink-0 overflow-hidden border-2 border-border bg-background">
												<img 
													src={conversation.sourceImageUrl} 
													alt="Imagem original" 
													class="h-full w-full object-cover"
												/>
												<div class="absolute inset-0 flex items-center justify-center bg-black/50">
													<span class="text-[10px] font-medium text-white">Original</span>
												</div>
											</div>
										</TooltipTrigger>
										<TooltipContent>
											<p>Imagem original</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							{/if}
							<!-- All outputs -->
							{#each allOutputs as output, index}
								<div class="group relative h-16 w-16 shrink-0 overflow-hidden border border-border bg-background hover:border-primary transition-colors">
									{#if output.url}
										<img 
											src={output.url} 
											alt="Edicao {index + 1}" 
											class="h-full w-full object-cover"
										/>
									{:else}
										<div class="flex h-full w-full items-center justify-center bg-muted">
											<svg class="h-4 w-4 animate-spin text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
												<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
												<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
											</svg>
										</div>
									{/if}
									<!-- Download button on hover -->
									{#if output.url}
										<button
											type="button"
											aria-label="Baixar imagem"
											class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
											onclick={() => downloadImage(output.url!, output.model)}
										>
											<svg class="h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
											</svg>
										</button>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Turns list -->
				<div class="flex-1 overflow-y-auto p-6">
					<div class="mx-auto max-w-3xl space-y-8">
						{#each turns as turn, index}
							<div class="space-y-4">
								<!-- Turn header -->
								<div class="flex items-center gap-3">
									<div class="h-2 w-2 rounded-full bg-primary"></div>
									<span class="text-xs font-medium uppercase text-muted-foreground">Edicao {index + 1}</span>
									{#if turn.status === "generating" || (turn.pendingModels && turn.pendingModels.length > 0)}
										<Badge variant="secondary">Gerando...</Badge>
									{/if}
								</div>
								
								<!-- User message -->
								<p class="text-sm leading-relaxed">{turn.userMessage}</p>
								
								<!-- Generated images -->
								<div class="flex flex-wrap gap-4">
									{#each turn.outputs as output}
										<div class="group relative overflow-hidden border border-border bg-background" style="width: 200px; aspect-ratio: {output.width} / {output.height};">
											{#if output.url}
												<img 
													src={output.url} 
													alt="Resultado" 
													class="h-full w-full object-cover"
												/>
												<!-- Overlay with model name and download -->
												<div class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
													<span class="text-xs text-white">{modelDisplayNames[output.model] ?? output.model}</span>
													<button
														type="button"
														aria-label="Baixar imagem"
														class="flex h-8 w-8 items-center justify-center bg-white/20 text-white hover:bg-white/30"
														onclick={() => downloadImage(output.url!, output.model)}
													>
														<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
														</svg>
													</button>
												</div>
											{:else}
												<div class="flex h-full w-full items-center justify-center bg-muted">
													<svg class="h-6 w-6 animate-spin text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
														<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
														<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
													</svg>
												</div>
											{/if}
											<!-- Model badge -->
											<div class="absolute bottom-2 left-2">
												<Badge variant="secondary" class="bg-background/90 text-[10px] backdrop-blur-sm">
													{modelDisplayNames[output.model] ?? output.model.split("/").pop()}
												</Badge>
											</div>
										</div>
									{/each}
									<!-- Skeletons for pending models -->
									{#each turn.pendingModels ?? [] as model}
										<div class="overflow-hidden" style="width: 200px;">
											<ImageSkeleton {model} aspectRatio={conversation.aspectRatio} />
										</div>
									{/each}
								</div>
							</div>
						{/each}

						{#if turns.length === 0}
							<div class="flex flex-col items-center justify-center py-12 text-center">
								<p class="text-sm text-muted-foreground">Nenhuma edicao ainda. Use o formulario abaixo para comecar.</p>
							</div>
						{/if}
					</div>
				</div>

				<!-- Input area -->
				<div class="shrink-0 border-t border-border bg-background p-4">
					<div class="mx-auto max-w-3xl space-y-4">
						<!-- Model selector (collapsed) -->
						<details class="group">
							<summary class="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
								<svg class="h-4 w-4 transition-transform group-open:rotate-90" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
								</svg>
								{selectedModels.length} {selectedModels.length === 1 ? 'modelo selecionado' : 'modelos selecionados'}
							</summary>
							<div class="mt-4">
								<ImageModelSelector 
									selected={selectedModels}
									onchange={(models) => selectedModels = models}
								/>
							</div>
						</details>

						<!-- Reference images -->
						{#if referenceImages.length > 0}
							<div class="flex flex-wrap gap-2">
								{#each referenceImages as ref (ref.id)}
									<div class="group relative">
										<div class="h-12 w-12 overflow-hidden border border-border bg-muted">
											<img 
												src={ref.url} 
												alt={ref.name}
												class="h-full w-full object-cover"
											/>
										</div>
										<button
											type="button"
											aria-label="Remover imagem"
											class="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
											onclick={() => removeReference(ref.id)}
										>
											<svg class="h-2.5 w-2.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>
								{/each}
							</div>
						{/if}

						<!-- Input row -->
						<div class="flex gap-3">
							<input
								bind:this={fileInputEl}
								type="file"
								accept="image/*"
								multiple
								class="hidden"
								onchange={handleFileSelect}
							/>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger>
										<button
											type="button"
											aria-label="Adicionar referencias"
											class="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
											onclick={() => fileInputEl.click()}
										>
											<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
											</svg>
										</button>
									</TooltipTrigger>
									<TooltipContent>
										<p>Adicionar imagens de referencia</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
							<Textarea
								bind:value={editPrompt}
								placeholder="Descreva a proxima edicao... (Cole imagens com Ctrl+V)"
								class="min-h-[40px] max-h-[120px] resize-none bg-background"
								rows={1}
								onpaste={handlePaste}
							/>
							<Button 
								onclick={handleSendEdit} 
								disabled={!editPrompt.trim() || selectedModels.length === 0 || isSending || isAnyGenerating}
								class="shrink-0"
							>
								{#if isSending}
									<svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
								{:else}
									<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
									</svg>
								{/if}
							</Button>
						</div>
						<p class="text-xs text-muted-foreground">
							<kbd class="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Cmd</kbd>
							+
							<kbd class="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>
							para enviar
						</p>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
