<script lang="ts">
	import { goto } from "$app/navigation";
	import { useQuery } from "convex-svelte";
	import { api } from "../../../convex/_generated/api.js";
	import type { Id } from "../../../convex/_generated/dataModel.js";
	import { Badge } from "$lib/components/ui";
	import { ImageGenerationPulseLoader } from "$lib/components/studio";
	import LightboxImage from "./LightboxImage.svelte";
	import LightboxConversationCard from "./LightboxConversationCard.svelte";
	import StudioLightboxShell from "./StudioLightboxShell.svelte";
	import LightboxSidebarHeader from "./LightboxSidebarHeader.svelte";
	import LightboxInfoCard from "./LightboxInfoCard.svelte";
	import LightboxIconButton from "./LightboxIconButton.svelte";

	interface MediaItem {
		_id: Id<"media_items">;
		url: string | null;
		thumbnailUrl?: string | null;
		model?: string;
		sourceType: string;
		prompt?: string;
		userPrompt?: string;
		generationDurationMs?: number;
		width: number;
		height: number;
		aspectRatio?: string;
		resolution?: string;
		createdAt: number;
		batchId?: Id<"media_generation_batches">;
		sourceConversationId?: Id<"image_edit_conversations">;
		sourceTurnId?: Id<"image_edit_turns">;
		sourceOutputId?: Id<"image_edit_outputs">;
		storageId: Id<"_storage">;
		mimeType: string;
	}

	interface TurnOutput {
		_id: Id<"image_edit_outputs">;
		url: string | null;
		thumbnailUrl?: string | null;
		model: string;
		width: number;
		height: number;
	}

	interface TurnData {
		_id: Id<"image_edit_turns">;
		userMessage: string;
		selectedModels: string[];
		aspectRatio: string;
		resolution: string;
		pendingModels?: string[];
		outputs: TurnOutput[];
	}

	type OutputCard =
		| { type: "item"; key: string; item: MediaItem }
		| { type: "pending"; key: string; model: string; aspectRatio?: string };

	interface Props {
		items: MediaItem[];
		currentMediaId: string;
		onclose: () => void;
		onnavigate: (mediaId: string) => void;
		onopenpost?: (postId: Id<"generated_posts">) => void;
		overrideCounterText?: string;
		overrideCanPrev?: boolean;
		overrideCanNext?: boolean;
		onprevglobal?: () => void;
		onnextglobal?: () => void;
	}

	let {
		items,
		currentMediaId,
		onclose,
		onnavigate,
		onopenpost,
		overrideCounterText,
		overrideCanPrev,
		overrideCanNext,
		onprevglobal,
		onnextglobal,
	}: Props = $props();

	const modelDisplayNames: Record<string, string> = {
		"google/gemini-2.5-flash-image": "Nano Banana",
		"google/gemini-3.1-flash-image-preview": "Nano Banana 2",
		"google/gemini-3-pro-image-preview": "Nano Banana Pro",
		"bytedance-seed/seedream-4.5": "SeeDream v4.5",
		"black-forest-labs/flux.2-flex": "Flux 2 Flex",
		"openai/gpt-5-image": "GPT Image 1.5",
	};

	let showModelPrompt = $state(false);
	let lastMediaId = $state<string | null>(null);

	let currentIndex = $derived(items.findIndex((item) => item._id === currentMediaId));
	let currentItem = $derived(currentIndex >= 0 ? items[currentIndex] : undefined);
	let canPrev = $derived(currentIndex > 0);
	let canNext = $derived(currentIndex < items.length - 1);
	let effectiveCanPrev = $derived(overrideCanPrev ?? canPrev);
	let effectiveCanNext = $derived(overrideCanNext ?? canNext);
	let counterText = $derived(
		overrideCounterText && overrideCounterText.trim().length > 0
			? overrideCounterText
			: `${currentIndex + 1} / ${items.length}`
	);

	const batchQuery = useQuery(
		api.mediaGenerationBatches.get,
		() => currentItem?.batchId ? { id: currentItem.batchId } : "skip"
	);
	const batchItemsQuery = useQuery(
		api.mediaItems.listByBatch,
		() => currentItem?.batchId ? { batchId: currentItem.batchId } : "skip"
	);
	const turnQuery = useQuery(
		api.imageEditTurns.get,
		() => currentItem?.sourceTurnId ? { id: currentItem.sourceTurnId } : "skip"
	);
	const turnMediaItemsQuery = useQuery(
		api.mediaItems.listBySourceOutputIds,
		() => {
			const outputIds =
				turnQuery.data?.outputs?.map((output: { _id: Id<"image_edit_outputs"> }) => output._id) ?? [];
			return outputIds.length > 0 ? { outputIds } : "skip";
		}
	);
	const relatedConversationsQuery = useQuery(
		api.imageEditConversations.listRelatedToMedia,
		() => currentItem ? { mediaId: currentItem._id } : "skip"
	);
	const relatedPostsQuery = useQuery(
		api.postMediaItems.listPostsForMediaWithPreview,
		() => currentItem ? { mediaItemId: currentItem._id } : "skip"
	);

	let batchData = $derived(batchQuery.data);
	let batchItems = $derived((batchItemsQuery.data ?? []) as MediaItem[]);
	let turnData = $derived((turnQuery.data ?? null) as TurnData | null);
	let turnMediaItems = $derived((turnMediaItemsQuery.data ?? []) as MediaItem[]);
	let relatedConversations = $derived(relatedConversationsQuery.data ?? []);
	let relatedPosts = $derived(relatedPostsQuery.data ?? []);
	let userPromptText = $derived(
		currentItem?.userPrompt?.trim() || turnData?.userMessage?.trim() || batchData?.prompt?.trim() || ""
	);
	let modelPromptText = $derived(currentItem?.prompt?.trim() ?? "");
	let hasDistinctModelPrompt = $derived(!!modelPromptText && modelPromptText !== userPromptText);

	let batchOutputCards = $derived(() => {
		if (!currentItem?.batchId) return [] as OutputCard[];

		const cards: OutputCard[] = [];
		const itemByModel = new Map(
			batchItems
				.filter((item) => !!item.model)
				.map((item) => [item.model as string, item])
		);
		const pendingModels = new Set(batchData?.pendingModels ?? []);
		const orderedModels = batchData?.requestedModels?.length
			? batchData.requestedModels
			: Array.from(
				new Set([
					...batchItems.map((item) => item.model).filter((model): model is string => !!model),
					...(batchData?.pendingModels ?? []),
				])
			);

		for (const model of orderedModels) {
			const item = itemByModel.get(model);
			if (item) {
				cards.push({ type: "item", key: item._id, item });
				continue;
			}

			if (pendingModels.has(model)) {
				cards.push({
					type: "pending",
					key: `pending-${currentItem.batchId}-${model}`,
					model,
					...(batchData?.aspectRatio ? { aspectRatio: batchData.aspectRatio } : {}),
				});
			}
		}

		for (const item of batchItems) {
			if (!cards.some((card) => card.type === "item" && card.item._id === item._id)) {
				cards.push({ type: "item", key: item._id, item });
			}
		}

		return cards;
	});

	let turnOutputCards = $derived(() => {
		if (!currentItem?.sourceTurnId || !turnData) return [] as OutputCard[];

		const cards: OutputCard[] = [];
		const outputByModel = new Map(turnData.outputs.map((output) => [output.model, output]));
		const itemByOutputId = new Map(
			turnMediaItems
				.filter((item) => !!item.sourceOutputId)
				.map((item) => [item.sourceOutputId as string, item])
		);
		const pendingModels = new Set(turnData.pendingModels ?? []);
		const orderedModels = turnData.selectedModels.length > 0
			? turnData.selectedModels
			: Array.from(
				new Set([
					...turnData.outputs.map((output) => output.model),
					...(turnData.pendingModels ?? []),
				])
			);

		for (const model of orderedModels) {
			const output = outputByModel.get(model);
			const item = output ? itemByOutputId.get(output._id as string) : undefined;
			if (item) {
				cards.push({ type: "item", key: item._id, item });
				continue;
			}

			if (pendingModels.has(model)) {
				cards.push({
					type: "pending",
					key: `pending-${currentItem.sourceTurnId}-${model}`,
					model,
					aspectRatio: turnData.aspectRatio,
				});
			}
		}

		for (const output of turnData.outputs) {
			const item = itemByOutputId.get(output._id as string);
			if (item && !cards.some((card) => card.type === "item" && card.item._id === item._id)) {
				cards.push({ type: "item", key: item._id, item });
			}
		}

		return cards;
	});

	let outputCards = $derived(() => {
		if (currentItem?.batchId) return batchOutputCards();
		if (currentItem?.sourceTurnId) return turnOutputCards();
		return [] as OutputCard[];
	});

	let showOutputs = $derived(
		outputCards().length > 1 ||
		((currentItem?.batchId ? batchData?.pendingModels?.length : turnData?.pendingModels?.length) ?? 0) > 0
	);
	let outputCount = $derived(() => {
		if (currentItem?.batchId) return batchData?.totalModels ?? outputCards().length;
		if (currentItem?.sourceTurnId) return turnData?.selectedModels.length ?? outputCards().length;
		return outputCards().length;
	});
	let outputProgressLabel = $derived(() => {
		if (currentItem?.batchId && batchData?.status === "generating") {
			return `${batchItems.length}/${batchData.totalModels} prontas`;
		}

		if (currentItem?.sourceTurnId && turnData && (turnData.pendingModels?.length ?? 0) > 0) {
			return `${turnData.outputs.length}/${turnData.selectedModels.length} prontas`;
		}

		return null;
	});

	$effect(() => {
		if (currentMediaId === lastMediaId) return;
		showModelPrompt = false;
		lastMediaId = currentMediaId;
	});

	function getModelDisplayName(model?: string): string {
		if (!model) return "Imagem";
		return modelDisplayNames[model] ?? model.split("/").pop() ?? model;
	}

	function getSourceLabel(sourceType: string): string {
		switch (sourceType) {
			case "generated":
				return "Gerada por IA";
			case "uploaded":
				return "Upload manual";
			case "edited":
				return "Imagem editada";
			case "imported":
				return "Imagem importada";
			default:
				return sourceType;
		}
	}

	function getAspectRatioValue(aspectRatio?: string, width?: number, height?: number): string {
		if (width && height) return `${width} / ${height}`;
		if (!aspectRatio) return "1 / 1";
		const [aspectWidth, aspectHeight] = aspectRatio.split(":");
		if (!aspectWidth || !aspectHeight) return "1 / 1";
		return `${aspectWidth} / ${aspectHeight}`;
	}

	function greatestCommonDivisor(a: number, b: number): number {
		return b === 0 ? a : greatestCommonDivisor(b, a % b);
	}

	function getAspectRatioLabel(aspectRatio?: string, width?: number, height?: number): string {
		if (aspectRatio) return aspectRatio;
		if (!width || !height) return "Não disponível";
		const divisor = greatestCommonDivisor(width, height);
		return `${width / divisor}:${height / divisor}`;
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString("pt-BR", {
			day: "2-digit",
			month: "long",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	function platformLabel(platform?: string): string {
		if (platform === "instagram") return "Instagram";
		if (platform === "twitter") return "X";
		if (platform === "linkedin") return "LinkedIn";
		return platform?.trim() ? platform : "Instagram";
	}

	function postStatusLabel(schedulingStatus?: string): string {
		if (schedulingStatus === "scheduled") return "Agendado";
		if (schedulingStatus === "posted") return "Publicado";
		if (schedulingStatus === "missed") return "Perdido";
		return "Rascunho";
	}

	function formatDuration(durationMs?: number): string | null {
		if (!durationMs || durationMs <= 0) return null;
		if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)}s`;

		const totalSeconds = Math.round(durationMs / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}m ${seconds}s`;
	}

	function handlePrev() {
	if (onprevglobal) {
		onprevglobal();
		return;
	}
		const prevItem = items[currentIndex - 1];
		if (canPrev && prevItem) {
			onnavigate(prevItem._id);
		}
	}

	function handleNext() {
	if (onnextglobal) {
		onnextglobal();
		return;
	}
		const nextItem = items[currentIndex + 1];
		if (canNext && nextItem) {
			onnavigate(nextItem._id);
		}
	}

	async function handleDownload() {
		if (!currentItem?.url) return;

		try {
			const response = await fetch(currentItem.url);
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			const modelName = currentItem.model?.split("/").pop() ?? "image";
			const extension = blob.type.split("/").pop() ?? "png";
			link.download = `vanda-${modelName}-${Date.now()}.${extension}`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error("Download failed:", err);
		}
	}

	function handleUseInPost() {
		if (!currentItem) return;
		// TODO: replace with a proper "compose new post from this media" mutation
		// that creates a draft post and opens it in the lightbox. For now this
		// just drops the user into the library where they can wire it up.
		goto(`/library`);
	}

	function handleRefine() {
		if (!currentItem) return;
		goto(`/library/conversations/new?sourceMediaId=${currentItem._id}`);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.target instanceof HTMLTextAreaElement) return;
		if (event.key === "Escape") onclose();
		if (event.key === "ArrowLeft") handlePrev();
		if (event.key === "ArrowRight") handleNext();
	}

</script>

<svelte:window onkeydown={handleKeydown} />

<StudioLightboxShell
	ariaLabel="Visualizador de imagem"
	{counterText}
	{onclose}
	canPrev={effectiveCanPrev}
	canNext={effectiveCanNext}
	onprev={handlePrev}
	onnext={handleNext}
	prevAriaLabel="Imagem anterior"
	nextAriaLabel="Próxima imagem"
	hasSidebar={!!currentItem}
>
	{#snippet main()}
		<LightboxImage
			imageUrl={currentItem?.url ?? null}
			width={currentItem?.width}
			height={currentItem?.height}
			canPrev={effectiveCanPrev}
			canNext={effectiveCanNext}
			onprev={handlePrev}
			onnext={handleNext}
			showNav={false}
		/>
	{/snippet}

	{#snippet sidebar()}
		{#if currentItem}
			<LightboxSidebarHeader
				title={currentItem.model ? getModelDisplayName(currentItem.model) : getSourceLabel(currentItem.sourceType)}
			>
				{#snippet badges()}
					<Badge variant="secondary">{getSourceLabel(currentItem.sourceType)}</Badge>
					{#if formatDuration(currentItem.generationDurationMs)}
						<Badge variant="secondary">{formatDuration(currentItem.generationDurationMs)}</Badge>
					{/if}
					{#if currentItem.aspectRatio}
						<Badge variant="secondary">{currentItem.aspectRatio}</Badge>
					{/if}
					{#if currentItem.resolution}
						<Badge variant="secondary">{currentItem.resolution}</Badge>
					{/if}
				{/snippet}

				{#snippet actions()}
					<LightboxIconButton ariaLabel="Nova conversa" onclick={handleRefine}>
						{#snippet icon()}
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M8 10h8m-8 4h5m5-7.5a2.5 2.5 0 012.5 2.5v6.5a2.5 2.5 0 01-2.5 2.5H9l-4 3v-3H5A2.5 2.5 0 012.5 15.5V9A2.5 2.5 0 015 6.5h13z" />
							</svg>
						{/snippet}
					</LightboxIconButton>

					{#if currentItem.url}
						<LightboxIconButton ariaLabel="Baixar" onclick={handleDownload}>
							{#snippet icon()}
								<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
								</svg>
							{/snippet}
						</LightboxIconButton>
					{/if}

					<LightboxIconButton ariaLabel="Usar em post" onclick={handleUseInPost}>
						{#snippet icon()}
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
							</svg>
						{/snippet}
					</LightboxIconButton>
				{/snippet}
			</LightboxSidebarHeader>

				<div class="flex-1 overflow-y-auto">
					<div class="space-y-5 p-5">
						<div class="grid grid-cols-2 gap-3">
							<LightboxInfoCard
								label="Tempo"
								value={formatDuration(currentItem.generationDurationMs) ?? "Não disponível"}
							/>
							<LightboxInfoCard
								label="Proporção"
								value={getAspectRatioLabel(currentItem.aspectRatio, currentItem.width, currentItem.height)}
							/>
							<LightboxInfoCard
								label="Dimensões"
								value={`${currentItem.width} × ${currentItem.height}`}
							/>
							<LightboxInfoCard
								label="Data"
								value={formatDate(currentItem.createdAt)}
							/>
						</div>

						{#if userPromptText}
							<div class="rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3">
								<div class="space-y-0.5">
									<p class="text-sm font-semibold text-foreground">Prompt do usuário</p>
									<p class="text-xs text-muted-foreground">O texto que você digitou para gerar esta imagem.</p>
								</div>

								<div class="mt-2.5 rounded-lg border border-white/6 bg-black/20 px-3 py-2.5">
									<p class="whitespace-pre-wrap text-[15px] leading-6 text-foreground/95">{userPromptText}</p>
								</div>
							</div>
						{/if}

						{#if modelPromptText && (!userPromptText || hasDistinctModelPrompt)}
							<div class="rounded-xl border border-border bg-card/60">
								<button
									type="button"
									class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
									onclick={() => (showModelPrompt = !showModelPrompt)}
								>
									<div>
										<p class="text-sm font-semibold text-foreground">Prompt enviado ao modelo</p>
										<p class="text-xs text-muted-foreground">A instrução final usada para gerar esta imagem.</p>
									</div>
									<svg class="h-4 w-4 shrink-0 text-muted-foreground transition-transform {showModelPrompt ? 'rotate-180' : ''}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
									</svg>
								</button>
								{#if showModelPrompt}
									<div class="border-t border-border px-4 py-4">
										<p class="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{modelPromptText}</p>
									</div>
								{/if}
							</div>
						{/if}

						{#if showOutputs}
							<div class="space-y-3">
								<div class="flex items-center justify-between">
									<h3 class="text-sm font-semibold text-foreground">
										Todas as saídas ({outputCount()})
									</h3>
									{#if outputProgressLabel()}
										<span class="text-xs text-muted-foreground">{outputProgressLabel()}</span>
									{/if}
								</div>

								<div class="grid grid-cols-3 gap-3">
									{#each outputCards() as card (card.key)}
										{#if card.type === "item"}
											<button
												type="button"
												class="overflow-hidden rounded-xl border bg-card text-left transition {card.item._id === currentItem._id ? 'border-primary ring-1 ring-primary/50' : 'border-border hover:border-primary/40'}"
												onclick={() => onnavigate(card.item._id)}
											>
												<div class="overflow-hidden bg-muted" style={`aspect-ratio: ${getAspectRatioValue(card.item.aspectRatio, card.item.width, card.item.height)};`}>
													{#if card.item.url}
														<img
															src={card.item.thumbnailUrl ?? card.item.url}
															alt={card.item.userPrompt ?? card.item.prompt ?? "Output"}
															loading="lazy"
															decoding="async"
															class="h-full w-full object-cover"
														/>
													{/if}
												</div>
												<div class="px-2 py-2">
													<p class="truncate text-xs font-medium text-foreground">
														{getModelDisplayName(card.item.model)}
													</p>
												</div>
											</button>
										{:else}
											<div class="overflow-hidden rounded-xl border border-dashed border-primary/30 bg-card/60 shadow-sm">
												<div class="relative bg-muted/30" style={`aspect-ratio: ${getAspectRatioValue(card.aspectRatio)};`}>
													<div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_35%),linear-gradient(to_bottom,rgba(255,255,255,0.02),rgba(255,255,255,0.06))]"></div>
													<div class="relative z-[1] flex h-full w-full flex-col items-center justify-center p-1.5">
														<ImageGenerationPulseLoader
															message="Gerando…"
															density="compact"
														/>
													</div>
												</div>
												<div class="px-2 py-2">
													<p class="truncate text-xs font-medium text-foreground">
														{getModelDisplayName(card.model)}
													</p>
												</div>
											</div>
										{/if}
									{/each}
								</div>
							</div>
						{/if}

						{#if relatedPosts.length > 0}
							<div class="space-y-3 border-t border-border/80 pt-5">
								<div class="flex items-center justify-between">
									<div>
										<p class="text-sm font-semibold text-foreground">Posts relacionados</p>
										<p class="text-xs text-muted-foreground">Esta imagem faz parte dos posts abaixo. Clique para abrir.</p>
									</div>
									<Badge variant="secondary">{relatedPosts.length}</Badge>
								</div>

								<div class="space-y-2">
									{#each relatedPosts as row (row.post._id)}
										<button
											type="button"
											class="flex w-full items-center gap-3 rounded-xl border border-border bg-card/60 p-2.5 text-left transition hover:border-primary/40 hover:bg-card"
											onclick={() => onopenpost?.(row.post._id)}
											aria-label={`Abrir post ${row.post.title?.trim() || row.post.projectName || "Sem título"}`}
										>
											<div class="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
												{#if row.post.coverUrl}
													<img
														src={row.post.coverUrl}
														alt=""
														loading="lazy"
														decoding="async"
														class="h-full w-full object-cover"
													/>
												{:else}
													<div class="flex h-full w-full items-center justify-center text-muted-foreground/50">
														<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159" />
														</svg>
													</div>
												{/if}
											</div>
											<div class="min-w-0 flex-1">
												<p class="truncate text-sm font-semibold text-foreground">
													{row.post.title?.trim() || row.post.projectName || "Sem título"}
												</p>
												<div class="mt-1 flex flex-wrap items-center gap-1.5">
													<Badge variant="secondary" class="text-[10px]">{platformLabel(row.post.platform)}</Badge>
													<Badge variant="secondary" class="text-[10px]">{postStatusLabel(row.post.schedulingStatus)}</Badge>
													<Badge variant="secondary" class="text-[10px]">
														{row.post.mediaCount} mídia{row.post.mediaCount === 1 ? "" : "s"}
													</Badge>
												</div>
											</div>
											<svg class="h-4 w-4 shrink-0 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
											</svg>
										</button>
									{/each}
								</div>
							</div>
						{/if}

						{#if relatedConversations.length > 0}
							<div class="space-y-3 border-t border-border/80 pt-5">
								<div class="flex items-center justify-between">
									<div>
										<p class="text-sm font-semibold text-foreground">Conversas relacionadas</p>
										<p class="text-xs text-muted-foreground">Continue uma conversa existente ou volte para uma ramificação anterior.</p>
									</div>
									<Badge variant="secondary">{relatedConversations.length}</Badge>
								</div>

								<div class="space-y-2">
									{#each relatedConversations as conversation (conversation._id)}
										<LightboxConversationCard conversation={conversation} />
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</div>
		{/if}
	{/snippet}
</StudioLightboxShell>
