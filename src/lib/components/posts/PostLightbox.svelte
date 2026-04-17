<script lang="ts">
	import { Badge, Button, Input, Textarea } from "$lib/components/ui";
	import InstagramPreview from "./InstagramPreview.svelte";
	import CarouselStrip from "./CarouselStrip.svelte";
	import MediaLibrarySheet from "./MediaLibrarySheet.svelte";
	import {
		StudioLightboxShell,
		LightboxSidebarHeader,
		LightboxInfoCard,
		LightboxIconButton,
	} from "$lib/components/lightbox";
	import { api } from "../../../convex/_generated/api.js";
	import type { Id } from "../../../convex/_generated/dataModel.js";
	import { useConvexClient, useQuery } from "convex-svelte";
	import { toast } from "svelte-sonner";

	type PostCard = {
		_id: Id<"generated_posts">;
		caption: string;
		title?: string;
		platform?: string;
		projectId?: Id<"projects">;
		projectName?: string;
		scheduledFor?: number;
		schedulingStatus?: string;
		updatedAt: number;
		mediaCount: number;
	};

	type MediaItem = {
		_id: Id<"media_items">;
		url: string | null;
		thumbnailUrl?: string | null;
		mimeType?: string;
		width: number;
		height: number;
	};

	interface Props {
		items: PostCard[];
		currentPostId: Id<"generated_posts">;
		onclose: () => void;
		onnavigate: (postId: Id<"generated_posts">) => void;
		onopenmedia?: (mediaItemId: Id<"media_items">) => void;
		overrideCounterText?: string;
		overrideCanPrev?: boolean;
		overrideCanNext?: boolean;
		onprevglobal?: () => void;
		onnextglobal?: () => void;
	}

	let {
		items,
		currentPostId,
		onclose,
		onnavigate,
		onopenmedia,
		overrideCounterText,
		overrideCanPrev,
		overrideCanNext,
		onprevglobal,
		onnextglobal,
	}: Props = $props();

	const client = useConvexClient();

	let previewIndex = $state(0);
	let lastPostId = $state<string | null>(null);

	let currentIndex = $derived(items.findIndex((item) => item._id === currentPostId));
	let currentPost = $derived(currentIndex >= 0 ? items[currentIndex] : null);
	let canPrev = $derived(currentIndex > 0);
	let canNext = $derived(currentIndex >= 0 && currentIndex < items.length - 1);
	let effectiveCanPrev = $derived(overrideCanPrev ?? canPrev);
	let effectiveCanNext = $derived(overrideCanNext ?? canNext);
	let counterText = $derived(
		overrideCounterText && overrideCounterText.trim().length > 0
			? overrideCounterText
			: `${Math.max(currentIndex, 0) + 1} / ${items.length}`
	);

	const postMediaQuery = useQuery(
		api.postMediaItems.listByPost,
		() => (currentPost ? { postId: currentPost._id } : "skip")
	);

	let postMediaRows = $derived(postMediaQuery.data ?? []);

	// Draft state for inline editing.
	// `saveComposedDraft` replaces the entire media list + caption in a single call,
	// so we keep a local draft that's committed either explicitly (media changes)
	// or on blur (caption/title) and hydrated from the query.
	let draftCaption = $state("");
	let draftTitle = $state("");
	let draftMediaItemIds = $state<Id<"media_items">[]>([]);
	let libraryOpen = $state(false);
	let isSaving = $state(false);
	/**
	 * Hydration is decoupled from post switches because `api.postMediaItems.listByPost`
	 * resolves asynchronously — when the user navigates, the committed list arrives a
	 * tick later. We track the "committed list we have already seen" and refresh the
	 * draft whenever it changes AND the user hasn't dirtied anything locally yet.
	 */
	let hydratedForPostId = $state<string | null>(null);
	let userEditedMedia = $state(false);

	// Resolved preview objects for the draft media ids. Used by the Instagram
	// preview, the carousel strip, and the thumbnail rail so all three reflect
	// pending changes instantly.
	const draftMediaQuery = useQuery(
		api.mediaItems.listByIds,
		() => (draftMediaItemIds.length > 0 ? { ids: draftMediaItemIds } : "skip")
	);

	let committedMediaItemIds = $derived(
		postMediaRows
			.map((row) => row?.mediaItem?._id)
			.filter((id): id is Id<"media_items"> => !!id)
	);

	let draftMediaById = $derived.by(() => {
		const map = new Map<string, MediaItem>();
		for (const item of draftMediaQuery.data ?? []) {
			if (!item) continue;
			map.set(item._id, {
				_id: item._id,
				url: item.url ?? null,
				thumbnailUrl: item.thumbnailUrl ?? null,
				mimeType: item.mimeType,
				width: item.width,
				height: item.height,
			});
		}
		return map;
	});

	let draftMediaItems = $derived.by(() => {
		return draftMediaItemIds
			.map((id) => draftMediaById.get(id))
			.filter((item): item is MediaItem => !!item);
	});

	let isCaptionDirty = $derived(draftCaption !== (currentPost?.caption ?? ""));
	let isTitleDirty = $derived(draftTitle !== (currentPost?.title ?? ""));
	let isMediaDirty = $derived.by(() => {
		if (!userEditedMedia) return false;
		if (committedMediaItemIds.length !== draftMediaItemIds.length) return true;
		for (let i = 0; i < committedMediaItemIds.length; i++) {
			if (committedMediaItemIds[i] !== draftMediaItemIds[i]) return true;
		}
		return false;
	});

	// When the post switches, reset caption/title immediately (they live on the
	// post doc and are available synchronously via `items`). Media ids need to
	// wait for the separate `listByPost` query.
	$effect(() => {
		if (!currentPost) return;
		if (currentPostId !== lastPostId) {
			draftCaption = currentPost.caption ?? "";
			draftTitle = currentPost.title ?? "";
			previewIndex = 0;
			userEditedMedia = false;
			hydratedForPostId = null;
			lastPostId = currentPostId;
		}
	});

	// Hydrate the media draft once the committed list has actually loaded for the
	// current post. Also adopts server updates when the user hasn't made local
	// edits yet.
	$effect(() => {
		if (!currentPost) return;
		const postLoaded = postMediaQuery.data !== undefined;
		if (!postLoaded) return;

		if (hydratedForPostId !== currentPostId) {
			draftMediaItemIds = [...committedMediaItemIds];
			hydratedForPostId = currentPostId;
			return;
		}

		if (!userEditedMedia && !arraysEqual(draftMediaItemIds, committedMediaItemIds)) {
			draftMediaItemIds = [...committedMediaItemIds];
		}
	});

	// Keep the preview index inside bounds when the draft shrinks.
	$effect(() => {
		if (previewIndex >= draftMediaItems.length) {
			previewIndex = Math.max(0, draftMediaItems.length - 1);
		}
	});

	function arraysEqual<T>(a: T[], b: T[]): boolean {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) return false;
		}
		return true;
	}

	function formatScheduledDate(timestamp: number): string {
		return new Date(timestamp).toLocaleString("pt-BR", {
			day: "2-digit",
			month: "long",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	function statusLabel(status?: string): string {
		if (status === "scheduled") return "Agendado";
		if (status === "posted") return "Publicado";
		if (status === "missed") return "Perdido";
		return "Rascunho";
	}

	async function handleCopyCaption() {
		if (!draftCaption.trim()) return;
		try {
			await navigator.clipboard.writeText(draftCaption);
			toast.success("Legenda copiada");
		} catch (err) {
			console.error("Failed to copy caption:", err);
			toast.error("Não foi possível copiar a legenda");
		}
	}

	function platformLabel(platform?: string): string {
		if (platform === "instagram") return "Instagram";
		if (platform === "twitter") return "X";
		if (platform === "linkedin") return "LinkedIn";
		return platform?.trim() ? platform : "Instagram";
	}

	function formatUpdatedDate(timestamp: number): string {
		return new Date(timestamp).toLocaleString("pt-BR", {
			day: "2-digit",
			month: "long",
			year: "numeric",
		});
	}

	function markMediaEdited() {
		userEditedMedia = true;
	}

	function handleReorder(fromIndex: number, toIndex: number) {
		if (toIndex < 0 || toIndex >= draftMediaItemIds.length) return;
		if (fromIndex === toIndex) return;
		const next = [...draftMediaItemIds];
		const [moved] = next.splice(fromIndex, 1);
		if (!moved) return;
		next.splice(toIndex, 0, moved);
		draftMediaItemIds = next;
		markMediaEdited();
	}

	function handleRemove(mediaItemId: Id<"media_items">) {
		if (draftMediaItemIds.length <= 1) {
			toast.info("O post precisa de pelo menos uma mídia");
			return;
		}
		draftMediaItemIds = draftMediaItemIds.filter((id) => id !== mediaItemId);
		markMediaEdited();
	}

	function handleLibrarySelect(mediaItemId: Id<"media_items">) {
		if (draftMediaItemIds.includes(mediaItemId)) return;
		draftMediaItemIds = [...draftMediaItemIds, mediaItemId];
		markMediaEdited();
	}

	function handleLibraryDeselect(mediaItemId: Id<"media_items">) {
		if (draftMediaItemIds.length <= 1) {
			toast.info("O post precisa de pelo menos uma mídia");
			return;
		}
		draftMediaItemIds = draftMediaItemIds.filter((id) => id !== mediaItemId);
		markMediaEdited();
	}

	async function persistDraft() {
		if (!currentPost) return;
		if (!isMediaDirty && !isCaptionDirty && !isTitleDirty) return;
		if (draftMediaItemIds.length === 0) {
			toast.error("Adicione pelo menos uma imagem");
			return;
		}
		isSaving = true;
		try {
			await client.mutation(api.generatedPosts.saveComposedDraft, {
				id: currentPost._id,
				...(currentPost.projectId ? { projectId: currentPost.projectId } : {}),
				...(currentPost.platform ? { platform: currentPost.platform } : {}),
				...(draftTitle.trim() ? { title: draftTitle.trim() } : {}),
				caption: draftCaption,
				mediaItemIds: draftMediaItemIds,
			});
			userEditedMedia = false;
			toast.success("Post atualizado");
		} catch (err) {
			console.error("Failed to save post:", err);
			toast.error("Não foi possível salvar o post");
		} finally {
			isSaving = false;
		}
	}

	function discardDraft() {
		if (!currentPost) return;
		draftCaption = currentPost.caption ?? "";
		draftTitle = currentPost.title ?? "";
		draftMediaItemIds = [...committedMediaItemIds];
		userEditedMedia = false;
	}

	function handleCaptionBlur() {
		if (!currentPost) return;
		if (!isCaptionDirty) return;
		// If only the caption changed, use the narrower mutation so we don't
		// touch media. If media/title are also dirty, let the user hit Save explicitly.
		if (isMediaDirty || isTitleDirty) return;
		void saveCaptionOnly();
	}

	function handleTitleBlur() {
		if (!currentPost) return;
		if (!isTitleDirty) return;
		// Title updates always go through the full draft mutation since there
		// is no dedicated updateTitle endpoint. If only the title is dirty we
		// can commit it inline; otherwise defer to explicit Save.
		if (isMediaDirty || isCaptionDirty) return;
		void persistDraft();
	}

	async function saveCaptionOnly() {
		if (!currentPost) return;
		try {
			await client.mutation(api.generatedPosts.updateCaption, {
				id: currentPost._id,
				caption: draftCaption,
			});
		} catch (err) {
			console.error("Failed to save caption:", err);
			toast.error("Não foi possível salvar a legenda");
		}
	}

	function handlePrev() {
		if (onprevglobal) {
			onprevglobal();
			return;
		}
		const previous = items[currentIndex - 1];
		if (previous) {
			onnavigate(previous._id);
		}
	}

	function handleNext() {
		if (onnextglobal) {
			onnextglobal();
			return;
		}
		const next = items[currentIndex + 1];
		if (next) {
			onnavigate(next._id);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
			return;
		}

		if (event.key === "Escape") {
			if (libraryOpen) {
				libraryOpen = false;
				return;
			}
			onclose();
		}
		if (event.key === "ArrowLeft") {
			handlePrev();
		}
		if (event.key === "ArrowRight") {
			handleNext();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<StudioLightboxShell
	ariaLabel="Visualizador de post"
	{counterText}
	{onclose}
	canPrev={effectiveCanPrev}
	canNext={effectiveCanNext}
	onprev={handlePrev}
	onnext={handleNext}
	prevAriaLabel="Post anterior"
	nextAriaLabel="Próximo post"
	hasSidebar={!!currentPost}
>
	{#snippet main()}
		<div
			class="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-6 pt-14 sm:px-6 sm:pb-8 sm:pt-16"
		>
			<div class="flex w-full max-w-[400px] shrink-0 flex-col items-center gap-4">
				<InstagramPreview
					variant="lightbox"
					mediaItems={draftMediaItems}
					caption={draftCaption}
					accountName={currentPost?.projectName ?? "sua_conta"}
					bind:currentIndex={previewIndex}
				/>

				{#if draftMediaItems.length > 1}
					<div class="flex max-w-full shrink-0 gap-2 overflow-x-auto pb-1 [scrollbar-gutter:stable]">
						{#each draftMediaItems as item, index (item._id)}
							<button
								type="button"
								class="shrink-0 overflow-hidden border transition {previewIndex === index
									? 'border-primary ring-1 ring-primary/30'
									: 'border-white/10 hover:border-white/25'}"
								onclick={() => (previewIndex = index)}
							>
								{#if item.url}
									<img src={item.thumbnailUrl ?? item.url} alt="" class="h-16 w-16 object-cover" />
								{:else}
									<div class="flex h-16 w-16 items-center justify-center bg-white/5 text-white/50">
										<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159" />
										</svg>
									</div>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/snippet}

	{#snippet sidebar()}
		{#if currentPost}
			<LightboxSidebarHeader
				title={draftTitle.trim() || currentPost.projectName || "Sem título"}
			>
				{#snippet badges()}
					<Badge variant="secondary">{platformLabel(currentPost.platform)}</Badge>
					<Badge variant="secondary">{statusLabel(currentPost.schedulingStatus)}</Badge>
					<Badge variant="secondary">
						{draftMediaItemIds.length} mídia{draftMediaItemIds.length === 1 ? "" : "s"}
					</Badge>
				{/snippet}

				{#snippet actions()}
					{#if draftCaption.trim()}
						<LightboxIconButton ariaLabel="Copiar legenda" onclick={handleCopyCaption}>
							{#snippet icon()}
								<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
								</svg>
							{/snippet}
						</LightboxIconButton>
					{/if}
				{/snippet}
			</LightboxSidebarHeader>

			<div class="min-h-0 flex-1 overflow-y-auto">
				<div class="space-y-5 p-5">
					<!-- Editable title -->
					<div class="space-y-1.5">
						<div class="flex items-center justify-between">
							<p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
								Título
							</p>
							{#if isTitleDirty && !isMediaDirty && !isCaptionDirty}
								<span class="text-[10px] font-medium uppercase tracking-wide text-primary">
									Salvando ao sair
								</span>
							{/if}
						</div>
						<Input
							bind:value={draftTitle}
							onblur={handleTitleBlur}
							placeholder="Adicione um título interno…"
							class="h-9 bg-background"
						/>
						<p class="text-[10px] text-muted-foreground">
							Usado só para organização — não aparece no post publicado.
						</p>
					</div>

					<div class="grid grid-cols-2 gap-3">
						<LightboxInfoCard label="Atualizado" value={formatUpdatedDate(currentPost.updatedAt)} />
						<LightboxInfoCard
							label="Agendamento"
							value={currentPost.scheduledFor
								? formatScheduledDate(currentPost.scheduledFor)
								: "Ainda não agendado"}
						/>
						<LightboxInfoCard label="Plataforma" value={platformLabel(currentPost.platform)} />
						<LightboxInfoCard
							label="Mídias"
							value={`${draftMediaItemIds.length} ${draftMediaItemIds.length === 1 ? "mídia" : "mídias"}`}
						/>
					</div>

					<!-- Editable caption -->
					<div class="rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3">
						<div class="flex items-start justify-between gap-3">
							<div class="space-y-0.5">
								<p class="text-sm font-semibold text-foreground">Legenda</p>
								<p class="text-xs text-muted-foreground">Edite o texto que será publicado junto com a mídia.</p>
							</div>
							{#if isCaptionDirty && !isMediaDirty}
								<span class="shrink-0 text-[10px] font-medium uppercase tracking-wide text-primary">
									Alterações não salvas
								</span>
							{/if}
						</div>

						<div class="mt-2.5 rounded-lg border border-white/6 bg-black/20">
							<Textarea
								bind:value={draftCaption}
								onblur={handleCaptionBlur}
								placeholder="Escreva a legenda do post…"
								class="min-h-[180px] resize-y border-0 bg-transparent text-[15px] leading-6 text-foreground/95 focus-visible:ring-0 focus-visible:ring-offset-0"
							/>
						</div>
					</div>

					<!-- Editable carousel -->
					<div class="space-y-3 border-t border-border/80 pt-5">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-sm font-semibold text-foreground">Mídias do post</p>
								<p class="text-xs text-muted-foreground">
									Reordene, remova ou adicione novas imagens da biblioteca.
								</p>
							</div>
							<Badge variant="secondary">{draftMediaItemIds.length}</Badge>
						</div>

						{#if draftMediaItems.length > 0}
							<CarouselStrip
								items={draftMediaItems}
								onreorder={handleReorder}
								onremove={handleRemove}
							/>
						{:else}
							<div class="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
								Nenhuma imagem no post ainda.
							</div>
						{/if}

						<div class="flex items-center gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								class="h-8 flex-1 gap-1.5"
								onclick={() => (libraryOpen = true)}
							>
								<svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
								</svg>
								Gerenciar imagens
							</Button>
							{#if onopenmedia && draftMediaItems[previewIndex]}
								<Button
									type="button"
									variant="ghost"
									size="sm"
									class="h-8 gap-1.5"
									onclick={() => {
										const id = draftMediaItems[previewIndex]?._id;
										if (id) onopenmedia(id);
									}}
								>
									<svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
									</svg>
									Abrir mídia atual
								</Button>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<!-- Sticky save/discard footer when media is dirty (caption/title alone auto-save on blur) -->
			{#if isMediaDirty}
				{@const dirtyPieces = [
					"mídia",
					isCaptionDirty ? "legenda" : null,
					isTitleDirty ? "título" : null,
				].filter((piece): piece is string => !!piece)}
				<div class="shrink-0 border-t border-border/80 bg-background/95 px-5 py-3 backdrop-blur-sm">
					<div class="flex items-center justify-between gap-2">
						<p class="text-xs text-muted-foreground">
							Alterações pendentes em {dirtyPieces.join(", ")}.
						</p>
						<div class="flex items-center gap-2">
							<Button type="button" variant="ghost" size="sm" class="h-8" onclick={discardDraft} disabled={isSaving}>
								Descartar
							</Button>
							<Button type="button" size="sm" class="h-8" onclick={persistDraft} disabled={isSaving || draftMediaItemIds.length === 0}>
								{isSaving ? "Salvando…" : "Salvar alterações"}
							</Button>
						</div>
					</div>
				</div>
			{/if}
		{/if}
	{/snippet}
</StudioLightboxShell>

<MediaLibrarySheet
	open={libraryOpen}
	selectedIds={draftMediaItemIds}
	projectId={currentPost?.projectId ?? null}
	onselect={handleLibrarySelect}
	ondeselect={handleLibraryDeselect}
	onclose={() => (libraryOpen = false)}
/>
