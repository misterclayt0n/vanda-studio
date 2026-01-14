<script lang="ts">
	import { Button, Textarea, Label, Badge, Separator, Input, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "$lib/components/ui";
	import { ImageModelSelector, AspectRatioSelector, ResolutionSelector } from "$lib/components/studio";
	import { SignedIn, SignedOut, SignInButton, UserButton } from "svelte-clerk";
	import Logo from "$lib/components/Logo.svelte";

	// Type definitions for studio settings
	type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "21:9";
	type Resolution = "standard" | "high" | "ultra";

	// Estado mock para demonstração da UI
	let prompt = $state("");
	let tone = $state("profissional");
	let customTone = $state("");
	let useCustomTone = $state(false);
	let platform = $state("instagram");
	let isGenerating = $state(false);
	let hasGenerated = $state(false);

	// Estado para configurações de imagem (Studio)
	let selectedModels = $state<string[]>(["google/gemini-3-pro-image-preview"]);
	let aspectRatio = $state<AspectRatio>("1:1");
	let resolution = $state<Resolution>("standard");
	
	// Estado para imagens de referência
	let referenceImages = $state<Array<{ id: string; url: string; name: string }>>([]);
	let fileInputEl: HTMLInputElement;

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files) return;
		
		const files = Array.from(input.files);
		files.forEach((file) => {
			const url = URL.createObjectURL(file);
			referenceImages = [...referenceImages, {
				id: crypto.randomUUID(),
				url,
				name: file.name
			}];
		});
		
		// Limpar input para permitir selecionar o mesmo arquivo novamente
		input.value = "";
	}

	function removeImage(id: string) {
		const image = referenceImages.find(img => img.id === id);
		if (image) {
			URL.revokeObjectURL(image.url);
		}
		referenceImages = referenceImages.filter(img => img.id !== id);
	}

	// Conteúdo mock gerado
	const mockCaption = `Eleve sua rotina matinal com intenção e propósito.

Todo dia de sucesso começa com um momento de clareza. Reserve um tempo para respirar, refletir e definir suas metas antes que o mundo exija sua atenção.

Qual é o seu ritual matinal inegociável?

#RotinaDaManha #Produtividade #Mindfulness #MentalidadeDeSucesso #HabitosDiarios`;

	const mockImageUrl = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=800&fit=crop";

	// Função mock de geração
	function handleGenerate() {
		isGenerating = true;
		// Simular delay da API
		setTimeout(() => {
			isGenerating = false;
			hasGenerated = true;
		}, 2000);
	}

	function handleRegenerate() {
		isGenerating = true;
		setTimeout(() => {
			isGenerating = false;
		}, 1500);
	}

	function handleCopyCaption() {
		navigator.clipboard.writeText(mockCaption);
	}

	// Mapeamento de tons para exibição
	const toneLabels: Record<string, string> = {
		profissional: "Profissional",
		casual: "Casual",
		inspirador: "Inspirador",
		humoristico: "Humorístico",
		educativo: "Educativo",
		promocional: "Promocional"
	};
</script>

<svelte:head>
	<title>Criar Post - Vanda Studio</title>
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
				<span class="text-sm text-muted-foreground">Criar Post</span>
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
								placeholder="Descreva o post que você quer criar. Seja específico sobre o tema, mensagem e pontos-chave que deseja incluir..."
								class="min-h-[140px] resize-none bg-background pb-12"
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

		<!-- Painel Direito - Visualização -->
		<main class="flex flex-1 flex-col overflow-hidden bg-muted/30">
			{#if !hasGenerated && !isGenerating}
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
			{:else if isGenerating}
				<!-- Estado de Carregamento -->
				<div class="flex flex-1 flex-col items-center justify-center gap-4 p-8">
					<div class="flex h-16 w-16 items-center justify-center rounded-none border border-border bg-background">
						<svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					</div>
					<div class="text-center">
						<h3 class="text-lg font-medium">Gerando seu post</h3>
						<p class="mt-1 text-sm text-muted-foreground">
							Nossa IA está criando o conteúdo perfeito para você...
						</p>
					</div>
				</div>
			{:else}
				<!-- Conteúdo Gerado -->
				<div class="flex flex-1 overflow-hidden">
					<!-- Seção da Imagem -->
					<div class="flex flex-1 flex-col border-r border-border">
						<div class="flex items-center justify-between border-b border-border bg-background px-4 py-3">
							<div class="flex items-center gap-2">
								<h3 class="text-sm font-medium">Imagem Gerada</h3>
								<Badge variant="secondary">1024x1024</Badge>
							</div>
							<div class="flex items-center gap-2">
								<Button variant="outline" size="sm" onclick={handleRegenerate}>
									<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
									</svg>
									Regenerar
								</Button>
								<Button variant="outline" size="sm">
									<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
									</svg>
									Baixar
								</Button>
							</div>
						</div>
						<div class="flex flex-1 items-center justify-center overflow-auto bg-muted/50 p-8">
							<div class="relative aspect-square w-full max-w-[500px] overflow-hidden border border-border bg-background shadow-sm">
								<img 
									src={mockImageUrl} 
									alt="Post gerado" 
									class="h-full w-full object-cover"
								/>
							</div>
						</div>
					</div>

					<!-- Seção da Legenda -->
					<div class="flex w-[380px] shrink-0 flex-col">
						<div class="flex items-center justify-between border-b border-border bg-background px-4 py-3">
							<h3 class="text-sm font-medium">Legenda</h3>
							<div class="flex items-center gap-2">
								<Button variant="ghost" size="sm" onclick={handleCopyCaption}>
									<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
									</svg>
									Copiar
								</Button>
								<Button variant="ghost" size="sm">
									<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
									</svg>
									Editar
								</Button>
							</div>
						</div>
						<div class="flex flex-1 flex-col overflow-auto bg-background">
							<div class="flex-1 p-4">
								<p class="whitespace-pre-wrap text-sm leading-relaxed">{mockCaption}</p>
							</div>
							
							<!-- Estatísticas e Metadados -->
							<div class="border-t border-border p-4">
								<div class="space-y-3">
									<div class="flex items-center justify-between text-sm">
										<span class="text-muted-foreground">Caracteres</span>
										<span class="font-mono">{mockCaption.length}</span>
									</div>
									<div class="flex items-center justify-between text-sm">
										<span class="text-muted-foreground">Hashtags</span>
										<span class="font-mono">5</span>
									</div>
									<Separator />
									<div class="flex flex-wrap gap-1.5">
										{#each ["#RotinaDaManha", "#Produtividade", "#Mindfulness", "#MentalidadeDeSucesso", "#HabitosDiarios"] as tag}
											<Badge variant="outline" class="text-xs">{tag}</Badge>
										{/each}
									</div>
								</div>
							</div>
						</div>

						<!-- Botões de Ação -->
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
