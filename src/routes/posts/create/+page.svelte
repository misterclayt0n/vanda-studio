<script lang="ts">
	import { Button, Textarea, Label, Badge, Separator, Input, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "$lib/components/ui";
	import { ImageModelSelector, CaptionModelSelector, AspectRatioSelector, ResolutionSelector, ImageSkeleton, EditImageModal, EditableCaption, ProjectSelector } from "$lib/components/studio";
	import { SignedIn, SignedOut, SignInButton, useClerkContext } from "svelte-clerk";
	import { useConvexClient, useQuery } from "convex-svelte";
	import { api } from "../../../convex/_generated/api.js";
	import type { Id } from "../../../convex/_generated/dataModel.js";
	import Navbar from "$lib/components/Navbar.svelte";
	import { page } from "$app/stores";

	// Type definitions for studio settings
	type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "21:9";
	type Resolution = "standard" | "high" | "ultra";

	// Generated image type from backend
	type GeneratedImage = {
		_id: Id<"generated_images">;
		storageId: Id<"_storage">;
		model: string;
		url: string | null;
		prompt: string;
		width: number;
		height: number;
		aspectRatio?: string;
		resolution?: string;
	};

	// Convex client and Clerk auth
	const client = useConvexClient();
	const clerk = useClerkContext();

	// Auth state
	let showLoginPrompt = $state(false);

	// Hide login prompt when user logs in
	$effect(() => {
		if (clerk.user && showLoginPrompt) {
			showLoginPrompt = false;
		}
	});

	// Project from URL params
	let urlProjectId = $derived($page.url.searchParams.get('projectId') as Id<"projects"> | null);

	// Form state
	let prompt = $state("");
	let tone = $state("profissional");
	let customTone = $state("");
	let useCustomTone = $state(false);
	let platform = $state("instagram");
	let captionModel = $state<string>("openai/gpt-4.1");
	let selectedProjectId = $state<Id<"projects"> | null>(null);

	// Initialize selectedProjectId from URL param
	$effect(() => {
		if (urlProjectId && selectedProjectId === null) {
			selectedProjectId = urlProjectId;
		}
	});

	// Generation state
	let isGenerating = $state(false);
	let hasGenerated = $state(false);
	let error = $state<string | null>(null);

	// Studio settings (declared early for derived state references)
	let selectedModels = $state<string[]>(["bytedance-seed/seedream-4.5"]);
	let aspectRatio = $state<AspectRatio>("1:1");
	let resolution = $state<Resolution>("standard");

	// Progressive loading state
	let generatedPostId = $state<Id<"generated_posts"> | null>(null);

	// Subscriptions using "skip" pattern for conditional queries
	const postQuery = useQuery(
		api.generatedPosts.get, 
		() => generatedPostId ? { id: generatedPostId } : "skip"
	);

	const imagesQuery = useQuery(
		api.generatedImages.listByPost,
		() => generatedPostId ? { generatedPostId } : "skip"
	);

	// Derived states from subscriptions
	let postData = $derived(postQuery.data);
	let imagesData = $derived(imagesQuery.data ?? []);

	// Progressive loading states (cast to handle missing fields before schema update)
	let isGeneratingCaption = $derived(postData?.status === "generating_caption");
	let isGeneratingImages = $derived(postData?.status === "generating_images");
	let isCompleted = $derived(postData?.status === "generated");
	let subscriptionCaption = $derived(postData?.caption ?? "");
	let pendingModels = $derived((postData as any)?.pendingImageModels ?? []);
	let totalModels = $derived((postData as any)?.totalImageModels ?? selectedModels.length);
	let hasAnyImage = $derived(imagesData.length > 0);
	let hasCaption = $derived(subscriptionCaption.length > 0);

	// Generated content (updated from subscriptions)
	let generatedCaption = $state("");
	let generatedImages = $state<GeneratedImage[]>([]);
	let selectedImageIndex = $state(0);

	// Edit modal state
	let editModalOpen = $state(false);
	let editModalImage = $state<GeneratedImage | null>(null);

	function openEditModal(image: GeneratedImage) {
		editModalImage = image;
		editModalOpen = true;
	}

	function closeEditModal() {
		editModalOpen = false;
		editModalImage = null;
	}

	// Sync subscription data to state
	$effect(() => {
		if (subscriptionCaption) {
			generatedCaption = subscriptionCaption;
		}
	});

	$effect(() => {
		if (imagesData.length > 0) {
			generatedImages = imagesData.map(img => ({
				_id: img._id,
				storageId: img.storageId,
				model: img.model,
				url: img.url,
				prompt: img.prompt,
				width: img.width,
				height: img.height,
				aspectRatio: img.aspectRatio,
				resolution: img.resolution,
			}));
		}
	});

	// Track when generation is complete
	$effect(() => {
		if (isCompleted && generatedPostId) {
			isGenerating = false;
		}
	});
	
	// Reference images state
	let referenceImages = $state<Array<{ id: string; url: string; name: string; file: File }>>([]);
	let fileInputEl: HTMLInputElement;

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

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files) return;
		
		addImageFiles(Array.from(input.files));
		
		// Clear input to allow selecting the same file again
		input.value = "";
	}

	function removeImage(id: string) {
		const image = referenceImages.find(img => img.id === id);
		if (image) {
			URL.revokeObjectURL(image.url);
		}
		referenceImages = referenceImages.filter(img => img.id !== id);
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

	// Build the full prompt with tone
	function buildFullPrompt(): string {
		const toneText = useCustomTone && customTone.trim() 
			? customTone.trim() 
			: toneLabels[tone];
		return `${prompt}\n\nTom: ${toneText}`;
	}

	// Upload a file to Convex storage
	async function uploadFileToStorage(file: File): Promise<Id<"_storage">> {
		// Get upload URL from Convex
		const uploadUrl = await client.mutation(api.referenceImages.generateUploadUrl, {});
		
		// Upload the file
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

	// Real generation function with progressive loading
	async function handleGenerate() {
		if (!prompt.trim()) return;

		// Check if user is authenticated
		if (!clerk.user) {
			showLoginPrompt = true;
			return;
		}

		isGenerating = true;
		error = null;
		hasGenerated = false;
		generatedPostId = null; // Reset to stop previous subscriptions
		generatedCaption = "";
		generatedImages = [];
		selectedImageIndex = 0;
		
		try {
			// Upload reference images to Convex storage first
			let imageStorageIds: Id<"_storage">[] = [];
			
			if (referenceImages.length > 0) {
				console.log(`Uploading ${referenceImages.length} reference images...`);
				
				const uploadPromises = referenceImages.map(img => uploadFileToStorage(img.file));
				imageStorageIds = await Promise.all(uploadPromises);
				
				console.log(`Uploaded ${imageStorageIds.length} images successfully`);
			}

			// Build attachments object if we have reference images
			const attachments = imageStorageIds.length > 0 
				? { imageStorageIds } 
				: undefined;

			// Call action - it will return generatedPostId
			// The action runs in the background, subscriptions will update UI progressively
			const result = await client.action(api.ai.chat.generate, {
				message: buildFullPrompt(),
				captionModel,
				imageModels: selectedModels,
				aspectRatio,
				resolution,
				...(attachments && { attachments }),
				...(selectedProjectId && { projectId: selectedProjectId }),
			});

			// Set ID to start subscriptions (this triggers reactive updates)
			generatedPostId = result.generatedPostId;
			hasGenerated = true;
			
			// Note: isGenerating will be set to false by the $effect when isCompleted becomes true
		} catch (err) {
			console.error("Generation failed:", err);
			error = err instanceof Error ? err.message : "Erro ao gerar conteudo";
			isGenerating = false;
		}
	}

	// Regenerate with same settings
	async function handleRegenerate() {
		await handleGenerate();
	}

	// Copy feedback state
	let showCopiedFeedback = $state(false);

	function handleCopyCaption() {
		navigator.clipboard.writeText(generatedCaption);
		showCopiedFeedback = true;
		setTimeout(() => {
			showCopiedFeedback = false;
		}, 2000);
	}

	// Download the selected image directly to browser
	async function handleDownloadImage() {
		if (!selectedImage?.url) return;
		
		try {
			const response = await fetch(selectedImage.url);
			const blob = await response.blob();
			
			// Create a download link
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			
			// Generate filename from model name
			const modelName = selectedImage.model.split('/').pop() ?? 'image';
			const extension = blob.type.split('/').pop() ?? 'png';
			link.download = `vanda-${modelName}-${Date.now()}.${extension}`;
			
			// Trigger download
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			
			// Clean up
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error('Download failed:', err);
		}
	}

	// Get selected image
	let selectedImage = $derived(generatedImages[selectedImageIndex] ?? null);

	// Actual image dimensions (loaded from image file)
	let actualDimensions = $state<{ width: number; height: number } | null>(null);

	// Load actual dimensions when image URL changes
	$effect(() => {
		const url = selectedImage?.url;
		if (url) {
			actualDimensions = null; // Reset while loading
			const img = new Image();
			img.onload = () => {
				actualDimensions = { width: img.naturalWidth, height: img.naturalHeight };
			};
			img.src = url;
		}
	});

	// Model name mapping for display
	const modelDisplayNames: Record<string, string> = {
		"google/gemini-2.5-flash-image": "Nano Banana",
		"google/gemini-3-pro-image-preview": "Nano Banana Pro",
		"bytedance-seed/seedream-4.5": "SeeDream v4.5",
		"black-forest-labs/flux.2-flex": "Flux 2 Flex",
		"openai/gpt-5-image": "GPT Image 1.5",
	};

	// Tone mapping for display
	const toneLabels: Record<string, string> = {
		profissional: "Profissional",
		casual: "Casual",
		inspirador: "Inspirador",
		humoristico: "Humoristico",
		educativo: "Educativo",
		promocional: "Promocional"
	};

	// Extract hashtags from caption
	let hashtags = $derived(
		generatedCaption.match(/#\w+/g) ?? []
	);
</script>

<svelte:head>
	<title>Criar Post - Vanda Studio</title>
</svelte:head>

<div class="flex h-screen flex-col bg-background">
	<Navbar />

	<!-- Conteúdo Principal -->
	<div class="flex min-h-0 flex-1">
		<!-- Painel Esquerdo - Configuração do Prompt -->
		<aside class="flex w-[400px] shrink-0 flex-col border-r border-border bg-sidebar">
			<div class="flex-1 overflow-y-auto p-6">
				<div class="space-y-6">
					<!-- Seção: Prompt -->
					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<Label class="text-sm font-medium">Prompt</Label>
							<Badge variant="secondary">Obrigatório</Badge>
						</div>
						<div class="relative">
							<Textarea
								bind:value={prompt}
								placeholder="Descreva o post que você quer criar. Seja específico sobre o tema, mensagem e pontos-chave que deseja incluir... (Cole imagens com Ctrl+V)"
								class="min-h-[140px] resize-none bg-background pb-12"
								onpaste={handlePaste}
							/>
							<!-- Barra de ações do prompt -->
							<div class="absolute bottom-2 left-2 right-2 flex items-center justify-between">
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
												aria-label="Anexar imagens de referência"
												class="flex h-8 w-8 items-center justify-center rounded-none border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
												onclick={() => fileInputEl.click()}
											>
												<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
												</svg>
											</button>
										</TooltipTrigger>
										<TooltipContent>
											<p>Anexar imagens de referência</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
								<span class="text-xs text-muted-foreground">
									{prompt.length} caracteres
								</span>
							</div>
						</div>
						
						<!-- Imagens de referência anexadas -->
						{#if referenceImages.length > 0}
							<div class="space-y-2">
								<Label class="text-xs text-muted-foreground">Imagens de referência</Label>
								<div class="flex flex-wrap gap-2">
									{#each referenceImages as image (image.id)}
										<div class="group relative">
											<div class="h-16 w-16 overflow-hidden rounded-none border border-border bg-muted">
												<img 
													src={image.url} 
													alt={image.name}
													class="h-full w-full object-cover"
												/>
											</div>
											<button
												type="button"
												aria-label="Remover imagem"
												class="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
												onclick={() => removeImage(image.id)}
											>
												<svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										</div>
									{/each}
									<!-- Botão para adicionar mais -->
									<button
										type="button"
										aria-label="Adicionar mais imagens"
										class="flex h-16 w-16 items-center justify-center rounded-none border border-dashed border-border bg-background text-muted-foreground transition-colors hover:border-primary hover:text-primary"
										onclick={() => fileInputEl.click()}
									>
										<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
										</svg>
									</button>
								</div>
							</div>
						{/if}
					</div>

					<Separator />

					<!-- Seção: Projeto -->
					<ProjectSelector
						value={selectedProjectId}
						onchange={(id) => selectedProjectId = id}
					/>

					<Separator />

					<!-- Seção: Tom -->
					<div class="space-y-3">
						<Label class="text-sm font-medium">Tom</Label>
						<div class="grid grid-cols-2 gap-2">
							{#each ["profissional", "casual", "inspirador", "humoristico", "educativo", "promocional"] as toneOption}
								<button
									class="h-9 rounded-none border px-3 text-sm transition-colors {!useCustomTone && tone === toneOption 
										? 'border-primary bg-primary/10 text-primary' 
										: 'border-border bg-background hover:bg-muted'}"
									onclick={() => { tone = toneOption; useCustomTone = false; }}
								>
									{toneLabels[toneOption]}
								</button>
							{/each}
						</div>
						<div class="relative">
							<Input
								type="text"
								bind:value={customTone}
								placeholder="Ou descreva seu próprio tom..."
								class="bg-background {useCustomTone ? 'border-primary ring-1 ring-primary' : ''}"
								onfocus={() => useCustomTone = true}
							/>
						</div>
					</div>

					<Separator />

					<!-- Seção: Plataforma -->
					<div class="space-y-3">
						<Label class="text-sm font-medium">Plataforma</Label>
						<div class="grid grid-cols-3 gap-2">
							<TooltipProvider>
								{#each [
									{ id: "instagram", label: "Instagram", enabled: true },
									{ id: "twitter", label: "Twitter/X", enabled: false },
									{ id: "linkedin", label: "LinkedIn", enabled: false }
								] as platformOption}
									{#if platformOption.enabled}
										<button
											class="h-9 rounded-none border px-3 text-sm transition-colors {platform === platformOption.id 
												? 'border-primary bg-primary/10 text-primary' 
												: 'border-border bg-background hover:bg-muted'}"
											onclick={() => platform = platformOption.id}
										>
											{platformOption.label}
										</button>
									{:else}
										<Tooltip>
											<TooltipTrigger>
												<button
													class="h-9 w-full rounded-none border border-border bg-muted/50 px-3 text-sm text-muted-foreground cursor-not-allowed"
													disabled
												>
													{platformOption.label}
												</button>
											</TooltipTrigger>
											<TooltipContent>
												<p>Em breve</p>
											</TooltipContent>
										</Tooltip>
									{/if}
								{/each}
							</TooltipProvider>
						</div>
					</div>

					<Separator />

					<!-- Seção: Modelo de Legenda -->
					<div class="space-y-3">
						<div class="flex items-center gap-2">
							<svg class="h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
							</svg>
							<Label class="text-sm font-medium">Modelo de Legenda</Label>
						</div>
						<CaptionModelSelector
							value={captionModel}
							onchange={(model) => captionModel = model}
						/>
					</div>

					<Separator />

					<!-- Seção: Modelo de Imagem -->
					<div class="space-y-3">
						<div class="flex items-center gap-2">
							<svg class="h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
							</svg>
							<Label class="text-sm font-medium">Modelo de Imagem</Label>
						</div>
						<ImageModelSelector
							selected={selectedModels}
							onchange={(models) => selectedModels = models}
						/>
					</div>

					<Separator />

					<!-- Seção: Proporção -->
					<div class="space-y-3">
						<div class="flex items-center gap-2">
							<svg class="h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
							</svg>
							<Label class="text-sm font-medium">Proporção</Label>
						</div>
						<AspectRatioSelector 
							value={aspectRatio}
							onchange={(ratio) => aspectRatio = ratio}
						/>
					</div>

					<Separator />

					<!-- Seção: Resolução -->
					<div class="space-y-3">
						<div class="flex items-center gap-2">
							<svg class="h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
							</svg>
							<Label class="text-sm font-medium">Resolução</Label>
						</div>
						<ResolutionSelector 
							value={resolution}
							onchange={(res) => resolution = res}
						/>
					</div>
				</div>
			</div>

			<!-- Botão Gerar -->
			<div class="shrink-0 border-t border-border bg-sidebar p-4">
				<Button
					class="w-full"
					disabled={!prompt.trim() || isGenerating}
					onclick={handleGenerate}
				>
					{#if isGenerating}
						<svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Gerando...
					{:else}
						Gerar Post
					{/if}
				</Button>
			</div>
		</aside>

		<!-- Painel Direito - Visualizacao -->
		<main class="flex flex-1 flex-col overflow-hidden bg-muted/30">
			{#if showLoginPrompt}
				<!-- Login Required State -->
				<div class="flex flex-1 flex-col items-center justify-center gap-4 p-8">
					<div class="flex h-16 w-16 items-center justify-center rounded-none border-2 border-primary/50 bg-primary/10">
						<svg class="h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
						</svg>
					</div>
					<div class="text-center">
						<h3 class="text-lg font-medium">Entre para continuar</h3>
						<p class="mt-1 max-w-md text-sm text-muted-foreground">
							Voce precisa estar logado para gerar posts. Faca login ou crie uma conta para comecar.
						</p>
					</div>
					<div class="flex gap-3 mt-2">
						<SignInButton mode="modal">
							<button class="h-9 rounded-none bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
								Entrar
							</button>
						</SignInButton>
						<Button variant="outline" onclick={() => showLoginPrompt = false}>
							Voltar
						</Button>
					</div>
				</div>
			{:else if error && !isGenerating}
				<!-- Estado de Erro -->
				<div class="flex flex-1 flex-col items-center justify-center gap-4 p-8">
					<div class="flex h-16 w-16 items-center justify-center rounded-none border-2 border-destructive/50 bg-destructive/10">
						<svg class="h-8 w-8 text-destructive" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
						</svg>
					</div>
					<div class="text-center">
						<h3 class="text-lg font-medium text-destructive">Erro na geracao</h3>
						<p class="mt-1 max-w-md text-sm text-muted-foreground">
							{error}
						</p>
						<Button variant="outline" class="mt-4" onclick={() => error = null}>
							Tentar novamente
						</Button>
					</div>
				</div>
			{:else if !hasGenerated && !isGenerating && !generatedPostId}
				<!-- Estado Vazio -->
				<div class="flex flex-1 flex-col items-center justify-center gap-4 p-8">
					<div class="flex h-16 w-16 items-center justify-center rounded-none border-2 border-dashed border-border bg-background">
						<svg class="h-8 w-8 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
						</svg>
					</div>
					<div class="text-center">
						<h3 class="text-lg font-medium">Pronto para criar</h3>
						<p class="mt-1 text-sm text-muted-foreground">
							Digite um prompt e clique em Gerar para criar seu post
						</p>
					</div>
				</div>
			{:else if isGenerating && !generatedPostId}
				<!-- Initial loading - uploading references, waiting for action -->
				<div class="flex flex-1 flex-col items-center justify-center gap-4 p-8">
					<div class="flex h-16 w-16 items-center justify-center rounded-none border border-border bg-background">
						<svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					</div>
					<div class="text-center">
						<h3 class="text-lg font-medium">Iniciando geracao</h3>
						<p class="mt-2 text-xs text-muted-foreground">
							Preparando arquivos...
						</p>
					</div>
				</div>
			{:else if generatedPostId && isGeneratingCaption}
				<!-- Caption loading -->
				<div class="flex flex-1 flex-col items-center justify-center gap-4 p-8">
					<div class="flex h-16 w-16 items-center justify-center rounded-none border border-border bg-background">
						<svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					</div>
					<div class="text-center">
						<h3 class="text-lg font-medium">Gerando legenda</h3>
						<p class="mt-2 text-xs text-muted-foreground">
							Criando uma legenda perfeita para seu post...
						</p>
					</div>
				</div>
			{:else if generatedPostId && hasCaption}
				<!-- Conteudo Gerado (progressivo) -->
				<div class="flex flex-1 overflow-hidden">
					<!-- Secao das Imagens -->
					<div class="flex flex-1 flex-col border-r border-border">
						<div class="flex items-center justify-between border-b border-border bg-background px-4 py-3">
							<div class="flex items-center gap-2">
								<h3 class="text-sm font-medium">Imagens Geradas</h3>
								{#if !hasAnyImage && (isGeneratingImages || pendingModels.length > 0)}
									<Badge variant="secondary">Gerando...</Badge>
								{:else if hasAnyImage}
									{#if selectedImage}
										<Badge variant="secondary">
											{#if actualDimensions}
												{actualDimensions.width}x{actualDimensions.height}
											{:else}
												{selectedImage.width}x{selectedImage.height}
											{/if}
										</Badge>
									{/if}
									{#if pendingModels.length > 0}
										<Badge variant="outline">{generatedImages.length}/{totalModels}</Badge>
									{:else if generatedImages.length > 1}
										<Badge variant="outline">{generatedImages.length} modelos</Badge>
									{/if}
								{/if}
							</div>
							<div class="flex items-center gap-2">
								<Button variant="outline" size="sm" onclick={handleRegenerate} disabled={isGenerating || pendingModels.length > 0}>
									{#if isGenerating || pendingModels.length > 0}
										<svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
										</svg>
									{:else}
										<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
										</svg>
									{/if}
									Regenerar
								</Button>
								{#if selectedImage?.url}
									<Button variant="outline" size="sm" onclick={handleDownloadImage}>
										<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
										</svg>
										Baixar
									</Button>
									<Button variant="outline" size="sm" onclick={() => openEditModal(selectedImage)}>
										<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
										</svg>
										Refinar
									</Button>
								{/if}
							</div>
						</div>
						
						<!-- Image grid / preview area -->
						<div class="flex flex-1 flex-col overflow-auto bg-muted/50">
							{#if !hasAnyImage && (isGeneratingImages || pendingModels.length > 0)}
								<!-- No images yet - show all skeletons in a grid -->
								<div class="flex flex-1 items-center justify-center p-8">
									<div class="grid grid-cols-2 gap-4 max-w-[600px] w-full">
										{#each selectedModels as model}
											<ImageSkeleton {model} {aspectRatio} />
										{/each}
									</div>
								</div>
							{:else if generatedImages.length === 0 && !isGeneratingImages && pendingModels.length === 0}
								<!-- No images generated (completed but empty) -->
								<div class="flex flex-1 items-center justify-center p-8">
									<p class="text-sm text-muted-foreground">Nenhuma imagem foi gerada</p>
								</div>
							{:else if generatedImages.length === 1 && pendingModels.length === 0}
								<!-- Single image - full size -->
								<div class="flex flex-1 items-center justify-center p-8">
									<div class="relative w-full max-w-[500px] overflow-hidden border border-border bg-background shadow-sm" style="aspect-ratio: {selectedImage?.width ?? 1} / {selectedImage?.height ?? 1};">
										{#if selectedImage?.url}
											<img 
												src={selectedImage.url} 
												alt="Post gerado" 
												class="h-full w-full object-cover"
											/>
										{:else}
											<div class="flex h-full w-full items-center justify-center bg-muted">
												<p class="text-sm text-muted-foreground">Imagem indisponivel</p>
											</div>
										{/if}
									</div>
								</div>
							{:else}
								<!-- Multiple images or some pending - grid with selection -->
								<div class="flex flex-1 flex-col">
									<!-- Main selected image -->
									<div class="flex flex-1 items-center justify-center p-6">
										{#if selectedImage}
											<div class="relative w-full max-w-[400px] overflow-hidden border-2 border-primary bg-background shadow-sm" style="aspect-ratio: {selectedImage?.width ?? 1} / {selectedImage?.height ?? 1};">
												{#if selectedImage?.url}
													<img 
														src={selectedImage.url} 
														alt="Post gerado selecionado" 
														class="h-full w-full object-cover"
													/>
												{:else}
													<div class="flex h-full w-full items-center justify-center bg-muted">
														<p class="text-sm text-muted-foreground">Imagem indisponivel</p>
													</div>
												{/if}
												<!-- Model badge overlay -->
												<div class="absolute bottom-2 left-2">
													<Badge variant="secondary" class="bg-background/90 backdrop-blur-sm">
														{modelDisplayNames[selectedImage?.model ?? ""] ?? selectedImage?.model}
													</Badge>
												</div>
											</div>
										{:else}
											<!-- No image selected yet, show first skeleton large -->
											<div class="w-full max-w-[400px]">
												<ImageSkeleton model={pendingModels[0]} {aspectRatio} />
											</div>
										{/if}
									</div>
									
									<!-- Thumbnail strip with images and skeletons for pending -->
									<div class="shrink-0 border-t border-border bg-background p-4">
										<div class="flex justify-center gap-3">
											{#each generatedImages as image, index}
												<div class="group relative">
													<button
														type="button"
														class="relative h-20 w-20 overflow-hidden border-2 transition-all {selectedImageIndex === index ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground'}"
														onclick={() => selectedImageIndex = index}
													>
														{#if image.url}
															<img 
																src={image.url} 
																alt="Opcao {index + 1}" 
																class="h-full w-full object-cover"
															/>
														{:else}
															<div class="flex h-full w-full items-center justify-center bg-muted">
																<svg class="h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
																	<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
																</svg>
															</div>
														{/if}
														<!-- Model name tooltip on hover -->
														<div class="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-center text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
															{modelDisplayNames[image.model] ?? image.model.split("/").pop()}
														</div>
													</button>
													<!-- Edit button overlay -->
													<button
														type="button"
														aria-label="Editar imagem"
														class="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center bg-primary text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-primary/90"
														onclick={(e) => { e.stopPropagation(); openEditModal(image); }}
													>
														<svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
														</svg>
													</button>
												</div>
											{/each}
											<!-- Skeletons for pending models -->
											{#each pendingModels as model}
												<ImageSkeleton {model} size="thumbnail" />
											{/each}
										</div>
									</div>
								</div>
							{/if}
						</div>
					</div>

					<!-- Secao da Legenda -->
					<div class="flex w-[380px] shrink-0 flex-col">
						<div class="flex items-center justify-between border-b border-border bg-background px-4 py-3">
							<h3 class="text-sm font-medium">Legenda</h3>
							<div class="flex items-center gap-2">
								<TooltipProvider>
									<Tooltip open={showCopiedFeedback}>
										<TooltipTrigger>
											<Button variant="ghost" size="sm" onclick={handleCopyCaption}>
												{#if showCopiedFeedback}
													<svg class="h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
													</svg>
												{:else}
													<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
													</svg>
												{/if}
												{showCopiedFeedback ? 'Copiado!' : 'Copiar'}
											</Button>
										</TooltipTrigger>
									</Tooltip>
								</TooltipProvider>
							</div>
						</div>
						<div class="flex flex-1 flex-col overflow-auto bg-background">
							<div class="flex-1 p-4">
								{#if generatedPostId}
									<EditableCaption
										postId={generatedPostId}
										caption={generatedCaption}
										showHashtags={true}
										showCharCount={false}
										onupdate={(newCaption) => generatedCaption = newCaption}
									/>
								{:else}
									<p class="whitespace-pre-wrap text-sm leading-relaxed">{generatedCaption}</p>
								{/if}
							</div>

							<!-- Estatisticas e Metadados -->
							<div class="border-t border-border p-4">
								<div class="space-y-3">
									<div class="flex items-center justify-between text-sm">
										<span class="text-muted-foreground">Caracteres</span>
										<span class="font-mono">{generatedCaption.length}</span>
									</div>
									<div class="flex items-center justify-between text-sm">
										<span class="text-muted-foreground">Hashtags</span>
										<span class="font-mono">{hashtags.length}</span>
									</div>
									{#if hashtags.length > 0}
										<Separator />
										<div class="flex flex-wrap gap-1.5">
											{#each hashtags as tag}
												<Badge variant="outline" class="text-xs">{tag}</Badge>
											{/each}
										</div>
									{/if}
								</div>
							</div>
						</div>

						<!-- Botoes de Acao -->
						<div class="shrink-0 border-t border-border bg-background p-4">
							<div class="flex gap-2">
								<Button variant="outline" class="flex-1">
									Salvar Rascunho
								</Button>
								<Button class="flex-1">
									Agendar Post
								</Button>
							</div>
						</div>
					</div>
				</div>
			{/if}
		</main>
	</div>
</div>

<!-- Edit Image Modal -->
{#if editModalImage}
	<EditImageModal 
		image={editModalImage}
		open={editModalOpen}
		onclose={closeEditModal}
	/>
{/if}
