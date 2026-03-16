<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import { ScheduleModal } from "$lib/components/calendar";
	import Navbar from "$lib/components/Navbar.svelte";
	import {
		CaptionModelSelector,
		ProjectSelector,
	} from "$lib/components/studio";
	import { Badge, Button, Input, Textarea } from "$lib/components/ui";
	import { api } from "../../../convex/_generated/api.js";
	import type { Id } from "../../../convex/_generated/dataModel.js";
	import { useConvexClient, useQuery } from "convex-svelte";
	import { SignedIn, SignedOut, SignInButton } from "svelte-clerk";

	type MediaItem = {
		_id: Id<"media_items">;
		url: string | null;
		model?: string;
		prompt?: string;
		sourceType: string;
		width: number;
		height: number;
		projectId?: Id<"projects">;
		createdAt: number;
	};

	type ComposerPost = {
		_id: Id<"generated_posts">;
		caption: string;
		projectId?: Id<"projects">;
		scheduledFor?: number;
		schedulingStatus?: string;
	};

	type LibraryScope = "all" | "project";

	const client = useConvexClient();

	const modelDisplayNames: Record<string, string> = {
		"google/gemini-2.5-flash-image": "Nano Banana",
		"google/gemini-3-pro-image-preview": "Nano Banana Pro",
		"bytedance-seed/seedream-4.5": "SeeDream v4.5",
		"black-forest-labs/flux.2-flex": "Flux 2 Flex",
		"openai/gpt-5-image": "GPT Image 1.5",
	};

	const sourceLabels: Record<string, string> = {
		generated: "Gerada",
		uploaded: "Upload",
		edited: "Editada",
		imported: "Importada",
	};

	function parseMediaIds(value: string | null): Id<"media_items">[] {
		if (!value) return [];
		return value
			.split(",")
			.map((id) => id.trim())
			.filter(Boolean) as Id<"media_items">[];
	}

	function dedupeMediaIds(ids: Id<"media_items">[]): Id<"media_items">[] {
		return [...new Set(ids)];
	}

	function formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleDateString("pt-BR", {
			day: "2-digit",
			month: "short",
			year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
		});
	}

	function formatScheduledDate(timestamp: number): string {
		return new Date(timestamp).toLocaleString("pt-BR", {
			day: "2-digit",
			month: "short",
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	const postIdFromUrl = $derived(
		$page.url.searchParams.get("postId") as Id<"generated_posts"> | null
	);
	const projectIdFromUrl = $derived(
		$page.url.searchParams.get("projectId") as Id<"projects"> | null
	);
	const mediaIdsFromUrl = $derived(
		parseMediaIds($page.url.searchParams.get("mediaIds"))
	);

	let activePostId = $state<Id<"generated_posts"> | null>(null);
	let selectedProjectId = $state<Id<"projects"> | null>(null);
	let selectedMediaIds = $state<Id<"media_items">[]>([]);
	let libraryScope = $state<LibraryScope>("all");
	let librarySearch = $state("");
	let captionBrief = $state("");
	let caption = $state("");
	let captionModel = $state("openai/gpt-4.1");
	let includeProjectContext = $state(true);
	let isGeneratingCaption = $state(false);
	let isSavingDraft = $state(false);
	let error = $state<string | null>(null);
	let scheduleModalOpen = $state(false);
	let hydratedPostId = $state<string | null>(null);
	let hydratedPostMediaId = $state<string | null>(null);
	let consumedMediaIdsSignature = $state("");

	const composerPostId = $derived(activePostId ?? postIdFromUrl);

	const postQuery = useQuery(
		api.generatedPosts.get,
		() => (composerPostId ? { id: composerPostId } : "skip")
	);
	const postMediaQuery = useQuery(
		api.postMediaItems.listByPost,
		() => (composerPostId ? { postId: composerPostId } : "skip")
	);
	const selectedMediaQuery = useQuery(
		api.mediaItems.listByIds,
		() =>
			selectedMediaIds.length > 0
				? { ids: selectedMediaIds }
				: "skip"
	);
	const allMediaQuery = useQuery(api.mediaItems.listByUser, () => ({ limit: 120 }));
	const projectMediaQuery = useQuery(
		api.mediaItems.listByProject,
		() =>
			libraryScope === "project" && selectedProjectId
				? { projectId: selectedProjectId }
				: "skip"
	);
	const selectedProjectQuery = useQuery(
		api.projects.get,
		() =>
			selectedProjectId
				? { projectId: selectedProjectId }
				: "skip"
	);
	const contextImagesQuery = useQuery(
		api.contextImages.list,
		() =>
			selectedProjectId
				? { projectId: selectedProjectId }
				: "skip"
	);

	let currentPost = $derived(postQuery.data as ComposerPost | null | undefined);
	let selectedProject = $derived(selectedProjectQuery.data);
	let contextImages = $derived(contextImagesQuery.data ?? []);
	let selectedMedia = $derived((selectedMediaQuery.data ?? []) as MediaItem[]);
	let linkedPostMedia = $derived(postMediaQuery.data ?? []);
	let libraryBaseItems = $derived(
		(
			libraryScope === "project" && selectedProjectId
				? projectMediaQuery.data ?? []
				: allMediaQuery.data?.items ?? []
		) as MediaItem[]
	);
	let libraryItems = $derived.by(() => {
		const query = librarySearch.trim().toLowerCase();
		if (!query) {
			return libraryBaseItems;
		}

		return libraryBaseItems.filter((item) => {
			const promptMatch = item.prompt?.toLowerCase().includes(query) ?? false;
			const modelMatch = item.model?.toLowerCase().includes(query) ?? false;
			const sourceMatch = sourceLabels[item.sourceType]?.toLowerCase().includes(query) ?? false;
			return promptMatch || modelMatch || sourceMatch;
		});
	});
	let coverMedia = $derived(selectedMedia[0] ?? null);
	let isEditingExistingPost = $derived(!!composerPostId);

	$effect(() => {
		if (projectIdFromUrl && !selectedProjectId && !composerPostId) {
			selectedProjectId = projectIdFromUrl;
			libraryScope = "project";
		}
	});

	$effect(() => {
		if (currentPost && composerPostId && hydratedPostId !== composerPostId) {
			activePostId = composerPostId;
			selectedProjectId = currentPost.projectId ?? null;
			caption = currentPost.caption;
			libraryScope = currentPost.projectId ? "project" : "all";
			hydratedPostId = composerPostId;
		}
	});

	$effect(() => {
		if (composerPostId && hydratedPostMediaId !== composerPostId && linkedPostMedia.length > 0) {
			selectedMediaIds = linkedPostMedia
				.filter((row): row is NonNullable<typeof row> => !!row)
				.map((row) => row.mediaItemId);
			hydratedPostMediaId = composerPostId;
		}
	});

	$effect(() => {
		const signature = mediaIdsFromUrl.join(",");
		if (!signature || consumedMediaIdsSignature === signature) {
			return;
		}

		selectedMediaIds = dedupeMediaIds([...selectedMediaIds, ...mediaIdsFromUrl]);
		consumedMediaIdsSignature = signature;
	});

	$effect(() => {
		if (!captionBrief && selectedMedia.length === 1 && selectedMedia[0]?.prompt) {
			captionBrief = selectedMedia[0].prompt ?? "";
		}
	});

	function isSelected(mediaId: Id<"media_items">): boolean {
		return selectedMediaIds.includes(mediaId);
	}

	function addMedia(mediaId: Id<"media_items">) {
		if (isSelected(mediaId)) return;
		selectedMediaIds = [...selectedMediaIds, mediaId];
	}

	function removeMedia(mediaId: Id<"media_items">) {
		selectedMediaIds = selectedMediaIds.filter((id) => id !== mediaId);
	}

	function moveMedia(mediaId: Id<"media_items">, direction: -1 | 1) {
		const currentIndex = selectedMediaIds.indexOf(mediaId);
		if (currentIndex === -1) return;

		const nextIndex = currentIndex + direction;
		if (nextIndex < 0 || nextIndex >= selectedMediaIds.length) return;

		const reordered = [...selectedMediaIds];
		const [item] = reordered.splice(currentIndex, 1);
		if (!item) return;
		reordered.splice(nextIndex, 0, item);
		selectedMediaIds = reordered;
	}

	function buildProjectContext() {
		if (!includeProjectContext || !selectedProjectId || !selectedProject) {
			return undefined;
		}

		const contextImageUrls = contextImages
			.map((image) => image.url)
			.filter((url): url is string => !!url);

		return {
			...(selectedProject.accountDescription && {
				accountDescription: selectedProject.accountDescription,
			}),
			...(selectedProject.brandTraits && {
				brandTraits: selectedProject.brandTraits,
			}),
			...(selectedProject.additionalContext && {
				additionalContext: selectedProject.additionalContext,
			}),
			...(contextImageUrls.length > 0 && { contextImageUrls }),
		};
	}

	function buildReferenceText(): string | undefined {
		if (selectedMedia.length === 0) return undefined;

		const chunks = selectedMedia.map((item, index) => {
			const lines = [
				`Imagem ${index + 1}`,
				`Origem: ${sourceLabels[item.sourceType] ?? item.sourceType}`,
				item.model
					? `Modelo: ${modelDisplayNames[item.model] ?? item.model}`
					: null,
				item.prompt ? `Prompt: ${item.prompt}` : null,
				`Tamanho: ${item.width}x${item.height}`,
			].filter(Boolean);

			return lines.join("\n");
		});

		return chunks.join("\n\n");
	}

	async function handleGenerateCaption() {
		if (!captionBrief.trim()) {
			error = "Descreva o briefing para gerar a legenda.";
			return;
		}

		isGeneratingCaption = true;
		error = null;

		try {
			const projectContext = buildProjectContext();
			const referenceText = buildReferenceText();
			const result = await client.action(api.ai.generateCaption.generate, {
				message: captionBrief.trim(),
				captionModel,
				...(projectContext && { projectContext }),
				...(referenceText && { referenceText }),
			});
			caption = result.caption;
		} catch (err) {
			error = err instanceof Error ? err.message : "Erro ao gerar legenda";
		} finally {
			isGeneratingCaption = false;
		}
	}

	function updateComposerUrl(postId: Id<"generated_posts">) {
		const url = new URL($page.url);
		url.searchParams.set("postId", postId);
		url.searchParams.delete("mediaIds");
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	async function saveDraft() {
		if (selectedMediaIds.length === 0) {
			error = "Selecione pelo menos uma imagem para criar o post.";
			return null;
		}

		isSavingDraft = true;
		error = null;

		try {
			const savedPostId = await client.mutation(api.generatedPosts.saveComposedDraft, {
				...(composerPostId && { id: composerPostId }),
				...(selectedProjectId && { projectId: selectedProjectId }),
				caption,
				mediaItemIds: selectedMediaIds,
			});

			activePostId = savedPostId;
			updateComposerUrl(savedPostId);
			return savedPostId;
		} catch (err) {
			error = err instanceof Error ? err.message : "Erro ao salvar rascunho";
			return null;
		} finally {
			isSavingDraft = false;
		}
	}

	async function handleSchedule() {
		const savedPostId = await saveDraft();
		if (savedPostId) {
			scheduleModalOpen = true;
		}
	}
</script>

<svelte:head>
	<title>{isEditingExistingPost ? "Editar Post" : "Novo Post"} - Vanda Studio</title>
</svelte:head>

<div class="flex h-screen flex-col bg-background">
	<Navbar />

	<SignedOut>
		<div class="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-20">
			<div class="max-w-md text-center">
				<h2 class="text-2xl font-semibold">Entre para montar seus posts</h2>
				<p class="mt-2 text-sm text-muted-foreground">
					Selecione imagens da biblioteca, gere uma legenda e agende tudo do mesmo lugar.
				</p>
			</div>
			<SignInButton mode="modal">
				<button class="h-10 rounded-none bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
					Entrar
				</button>
			</SignInButton>
		</div>
	</SignedOut>

	<SignedIn>
		<div class="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_420px]">
			<main class="min-h-0 overflow-y-auto border-b border-border lg:border-b-0 lg:border-r">
				<div class="border-b border-border bg-muted/20 px-6 py-5">
					<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<div class="flex items-center gap-2">
								<h1 class="text-xl font-semibold">
									{isEditingExistingPost ? "Editor de post" : "Compositor de post"}
								</h1>
								{#if currentPost?.schedulingStatus === "scheduled" && currentPost.scheduledFor}
									<Badge variant="outline">
										Agendado para {formatScheduledDate(currentPost.scheduledFor)}
									</Badge>
								{/if}
							</div>
							<p class="mt-1 text-sm text-muted-foreground">
								Monte um rascunho com imagens existentes da biblioteca. A imagem de capa define o preview do post.
							</p>
						</div>

						<div class="flex items-center gap-2">
							<Button variant="outline" onclick={() => goto("/images")}>
								Ir para imagens
							</Button>
							<Button variant="outline" onclick={saveDraft} disabled={isSavingDraft || selectedMediaIds.length === 0}>
								{isSavingDraft ? "Salvando..." : "Salvar rascunho"}
							</Button>
						</div>
					</div>
				</div>

				<section class="space-y-8 px-6 py-6">
					<div>
						<div class="mb-3 flex items-center justify-between">
							<div>
								<h2 class="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
									Selecao
								</h2>
								<p class="mt-1 text-sm text-muted-foreground">
									{selectedMedia.length} imagem{selectedMedia.length !== 1 ? "ns" : ""} selecionada{selectedMedia.length !== 1 ? "s" : ""}
								</p>
							</div>
							{#if selectedMedia.length > 0}
								<Button variant="ghost" size="sm" onclick={() => (selectedMediaIds = [])}>
									Limpar
								</Button>
							{/if}
						</div>

						{#if selectedMedia.length === 0}
							<div class="flex flex-col items-center justify-center border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
								<div class="flex h-16 w-16 items-center justify-center border border-border bg-background">
									<svg class="h-8 w-8 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
									</svg>
								</div>
								<h3 class="mt-4 text-lg font-medium">Escolha as imagens do post</h3>
								<p class="mt-2 max-w-md text-sm text-muted-foreground">
									Selecione uma ou mais imagens na biblioteca abaixo, ou volte para o workspace de imagens para gerar novas opcoes.
								</p>
							</div>
						{:else}
							<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
								{#each selectedMedia as item, index (item._id)}
									<div class="overflow-hidden border border-border bg-card">
										<div class="relative aspect-square overflow-hidden bg-muted">
											{#if item.url}
												<img src={item.url} alt="" class="h-full w-full object-cover" />
											{/if}
											<div class="absolute left-3 top-3 flex items-center gap-2">
												<Badge variant="secondary">{index === 0 ? "Capa" : `#${index + 1}`}</Badge>
												<Badge variant="outline">{sourceLabels[item.sourceType] ?? item.sourceType}</Badge>
											</div>
										</div>
										<div class="space-y-3 p-4">
											<div class="space-y-1">
												<div class="flex items-center justify-between gap-2">
													<span class="text-sm font-medium">
														{item.model ? modelDisplayNames[item.model] ?? item.model.split("/").pop() : "Imagem da biblioteca"}
													</span>
													<span class="text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
												</div>
												{#if item.prompt}
													<p class="line-clamp-3 text-sm text-muted-foreground">{item.prompt}</p>
												{/if}
											</div>
											<div class="flex items-center gap-2">
												<Button variant="outline" size="sm" onclick={() => moveMedia(item._id, -1)} disabled={index === 0}>
													Subir
												</Button>
												<Button variant="outline" size="sm" onclick={() => moveMedia(item._id, 1)} disabled={index === selectedMedia.length - 1}>
													Descer
												</Button>
												<Button variant="ghost" size="sm" class="ml-auto text-destructive hover:text-destructive" onclick={() => removeMedia(item._id)}>
													Remover
												</Button>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<div>
						<div class="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
							<div>
								<h2 class="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
									Biblioteca
								</h2>
								<p class="mt-1 text-sm text-muted-foreground">
									Puxe imagens existentes da biblioteca para este rascunho.
								</p>
							</div>

							<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
								<div class="flex items-center gap-2">
									<Button
										variant={libraryScope === "all" ? "secondary" : "outline"}
										size="sm"
										onclick={() => (libraryScope = "all")}
									>
										Todas
									</Button>
									<Button
										variant={libraryScope === "project" ? "secondary" : "outline"}
										size="sm"
										onclick={() => (libraryScope = "project")}
										disabled={!selectedProjectId}
									>
										Projeto do post
									</Button>
								</div>
								<Input
									value={librarySearch}
									oninput={(event) => (librarySearch = (event.currentTarget as HTMLInputElement).value)}
									placeholder="Buscar por prompt, modelo ou origem"
									class="w-full sm:w-72"
								/>
							</div>
						</div>

						{#if allMediaQuery.isLoading || projectMediaQuery.isLoading}
							<div class="flex items-center justify-center py-16">
								<svg class="h-7 w-7 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
							</div>
						{:else if libraryItems.length === 0}
							<div class="flex flex-col items-center justify-center border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
								<h3 class="text-lg font-medium">Nenhuma imagem disponivel</h3>
								<p class="mt-2 max-w-md text-sm text-muted-foreground">
									{libraryScope === "project" && selectedProjectId
										? "Este projeto ainda nao possui imagens na biblioteca."
										: "Sua biblioteca ainda esta vazia. Gere ou envie imagens primeiro."}
								</p>
								<Button class="mt-4" onclick={() => goto("/images")}>
									Abrir workspace de imagens
								</Button>
							</div>
						{:else}
							<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
								{#each libraryItems as item (item._id)}
									<button
										type="button"
										class={`overflow-hidden border text-left transition-colors ${
											isSelected(item._id)
												? "border-primary bg-primary/5"
												: "border-border bg-card hover:border-primary/40"
										}`}
										onclick={() => (isSelected(item._id) ? removeMedia(item._id) : addMedia(item._id))}
									>
										<div class="relative aspect-square overflow-hidden bg-muted">
											{#if item.url}
												<img src={item.url} alt="" class="h-full w-full object-cover" />
											{/if}
											<div class="absolute left-3 top-3 flex items-center gap-2">
												<Badge variant="secondary">
													{sourceLabels[item.sourceType] ?? item.sourceType}
												</Badge>
												{#if isSelected(item._id)}
													<Badge>Selecionada</Badge>
												{/if}
											</div>
										</div>
										<div class="space-y-2 p-4">
											<div class="flex items-center justify-between gap-2">
												<span class="text-sm font-medium">
													{item.model ? modelDisplayNames[item.model] ?? item.model.split("/").pop() : "Imagem da biblioteca"}
												</span>
												<span class="text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
											</div>
											{#if item.prompt}
												<p class="line-clamp-2 text-sm text-muted-foreground">{item.prompt}</p>
											{:else}
												<p class="text-sm text-muted-foreground">Sem prompt salvo</p>
											{/if}
										</div>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				</section>
			</main>

			<aside class="min-h-0 overflow-y-auto bg-muted/20">
				<div class="space-y-6 px-6 py-6">
					<div class="space-y-3">
						<h2 class="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
							Draft
						</h2>

						{#if coverMedia?.url}
							<div class="overflow-hidden border border-border bg-card">
								<img src={coverMedia.url} alt="" class="aspect-square h-full w-full object-cover" />
							</div>
						{:else}
							<div class="flex aspect-square items-center justify-center border border-dashed border-border bg-background">
								<span class="text-sm text-muted-foreground">Selecione uma imagem de capa</span>
							</div>
						{/if}
					</div>

					<ProjectSelector
						value={selectedProjectId}
						onchange={(projectId) => {
							selectedProjectId = projectId;
							if (!projectId) {
								libraryScope = "all";
							}
						}}
					/>

					<div class="space-y-2">
						<div class="flex items-center justify-between gap-3">
							<div>
								<p class="text-sm font-medium">Usar contexto do projeto</p>
								<p class="text-xs text-muted-foreground">
									Inclui descricao, brand traits e imagens de contexto na geracao da legenda.
								</p>
							</div>
							<button
								type="button"
								aria-label="Alternar contexto do projeto"
								aria-checked={includeProjectContext}
								role="switch"
								class={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
									includeProjectContext ? "bg-primary" : "bg-muted"
								}`}
								onclick={() => (includeProjectContext = !includeProjectContext)}
							>
								<span
									class={`h-5 w-5 rounded-full bg-background shadow transition-transform ${
										includeProjectContext ? "translate-x-5" : "translate-x-1"
									}`}
								></span>
							</button>
						</div>
					</div>

					<div class="space-y-2">
						<p class="text-sm font-medium">Briefing da legenda</p>
						<Textarea
							bind:value={captionBrief}
							placeholder="Descreva o objetivo do post, CTA, tom e mensagens principais."
							class="min-h-[120px] resize-none bg-background"
						/>
					</div>

					<div class="space-y-2">
						<p class="text-sm font-medium">Modelo de legenda</p>
						<CaptionModelSelector value={captionModel} onchange={(value) => (captionModel = value)} />
					</div>

					<Button
						class="w-full"
						onclick={handleGenerateCaption}
						disabled={isGeneratingCaption || !captionBrief.trim()}
					>
						{isGeneratingCaption ? "Gerando legenda..." : "Gerar legenda"}
					</Button>

					<div class="space-y-2">
						<div class="flex items-center justify-between gap-3">
							<p class="text-sm font-medium">Legenda final</p>
							{#if caption.length > 0}
								<span class="text-xs text-muted-foreground">{caption.length} caracteres</span>
							{/if}
						</div>
						<Textarea
							bind:value={caption}
							placeholder="Edite a legenda manualmente ou gere uma nova versao."
							class="min-h-[220px] resize-none bg-background"
						/>
					</div>

					{#if error}
						<div class="rounded-none border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
							{error}
						</div>
					{/if}

					<div class="space-y-3 border-t border-border pt-4">
						<Button class="w-full" onclick={saveDraft} disabled={isSavingDraft || selectedMediaIds.length === 0}>
							{isSavingDraft ? "Salvando..." : isEditingExistingPost ? "Atualizar rascunho" : "Salvar rascunho"}
						</Button>
						<Button variant="outline" class="w-full" onclick={handleSchedule} disabled={isSavingDraft || selectedMediaIds.length === 0}>
							Salvar e agendar
						</Button>
					</div>
				</div>
			</aside>
		</div>
	</SignedIn>
</div>

{#if activePostId && coverMedia}
	<ScheduleModal
		open={scheduleModalOpen}
		onclose={() => (scheduleModalOpen = false)}
		postId={activePostId}
		caption={caption}
		imageUrl={coverMedia.url}
		projectName={selectedProject?.name}
	/>
{/if}
