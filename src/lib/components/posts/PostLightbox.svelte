<script lang="ts">
	import { Badge, Button } from "$lib/components/ui";
	import InstagramPreview from "./InstagramPreview.svelte";
	import { api } from "../../../convex/_generated/api.js";
	import type { Id } from "../../../convex/_generated/dataModel.js";
	import { useQuery } from "convex-svelte";

	type PostCard = {
		_id: Id<"generated_posts">;
		caption: string;
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
		onedit: (postId: Id<"generated_posts">) => void;
	}

	let { items, currentPostId, onclose, onnavigate, onedit }: Props = $props();

	let previewIndex = $state(0);
	let lastPostId = $state<string | null>(null);

	let currentIndex = $derived(items.findIndex((item) => item._id === currentPostId));
	let currentPost = $derived(currentIndex >= 0 ? items[currentIndex] : null);
	let canPrev = $derived(currentIndex > 0);
	let canNext = $derived(currentIndex >= 0 && currentIndex < items.length - 1);

	const postMediaQuery = useQuery(
		api.postMediaItems.listByPost,
		() => (currentPost ? { postId: currentPost._id } : "skip")
	);

	let mediaItems = $derived.by(() => {
		const rows = postMediaQuery.data ?? [];
		return rows
			.map((row) => row?.mediaItem)
			.filter((item): item is NonNullable<(typeof rows)[number]>["mediaItem"] => !!item)
			.map((item) => ({
				_id: item._id,
				url: item.url ?? null,
				mimeType: item.mimeType,
				width: item.width,
				height: item.height,
			})) as MediaItem[];
	});

	$effect(() => {
		if (currentPostId === lastPostId) return;
		lastPostId = currentPostId;
		previewIndex = 0;
	});

	$effect(() => {
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "";
		};
	});

	function formatScheduledDate(timestamp: number): string {
		return new Date(timestamp).toLocaleString("pt-BR", {
			day: "2-digit",
			month: "long",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	function formatUpdatedDate(timestamp: number): string {
		return new Date(timestamp).toLocaleString("pt-BR", {
			day: "2-digit",
			month: "long",
			year: "numeric",
		});
	}

	function handlePrev() {
		const previous = items[currentIndex - 1];
		if (previous) {
			onnavigate(previous._id);
		}
	}

	function handleNext() {
		const next = items[currentIndex + 1];
		if (next) {
			onnavigate(next._id);
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onclose();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
			return;
		}

		if (event.key === "Escape") {
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

<div
	class="fixed inset-0 z-50 flex animate-in fade-in duration-150"
	role="dialog"
	aria-modal="true"
	aria-label="Visualizador de post"
>
	<div
		class="absolute inset-0 bg-black/88"
		role="button"
		tabindex="-1"
		aria-label="Fechar visualizador"
		onclick={handleBackdropClick}
		onkeydown={(event) => event.key === "Enter" && onclose()}
	></div>

	<div class="relative flex h-full w-full">
		<div class="relative flex flex-1 items-center justify-center bg-black/60 px-6 py-10">
			<div class="absolute left-4 top-4 z-10 flex items-center gap-2 text-sm text-white/70">
				<span>{Math.max(currentIndex, 0) + 1} / {items.length}</span>
			</div>

			{#if canPrev}
				<button
					type="button"
					aria-label="Post anterior"
					class="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center border border-white/10 bg-white/10 text-white/80 backdrop-blur transition hover:bg-white/20 hover:text-white"
					onclick={handlePrev}
				>
					<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
					</svg>
				</button>
			{/if}

			{#if canNext}
				<button
					type="button"
					aria-label="Próximo post"
					class="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center border border-white/10 bg-white/10 text-white/80 backdrop-blur transition hover:bg-white/20 hover:text-white"
					onclick={handleNext}
				>
					<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
					</svg>
				</button>
			{/if}

			<div class="flex max-w-[440px] flex-col items-center gap-6">
				<InstagramPreview
					mediaItems={mediaItems}
					caption={currentPost?.caption ?? ""}
					accountName={currentPost?.projectName ?? "sua_conta"}
					bind:currentIndex={previewIndex}
				/>

				{#if mediaItems.length > 1}
					<div class="flex max-w-full gap-2 overflow-x-auto pb-2">
						{#each mediaItems as item, index (item._id)}
							<button
								type="button"
								class="overflow-hidden border transition {previewIndex === index ? 'border-primary ring-1 ring-primary/30' : 'border-white/10 hover:border-white/25'}"
								onclick={() => (previewIndex = index)}
							>
								{#if item.url}
									<img src={item.url} alt="" class="h-16 w-16 object-cover" />
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

		<aside class="relative flex w-[380px] shrink-0 flex-col border-l border-white/10 bg-[#0f1015] text-white">
			<div class="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
				<div class="min-w-0">
					<p class="text-xs font-medium uppercase tracking-wide text-white/45">Post</p>
					<h2 class="mt-2 truncate text-3xl font-semibold leading-none">
						{currentPost?.projectName ?? "Sem projeto"}
					</h2>
				</div>

				<div class="flex items-center gap-2">
					<Button class="h-10 px-4" onclick={() => currentPost && onedit(currentPost._id)}>
						Editar post
					</Button>
					<button
						type="button"
						aria-label="Fechar"
						class="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:text-white"
						onclick={onclose}
					>
						<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
				<div class="space-y-5">
					<div class="flex flex-wrap items-center gap-2">
						<Badge variant="secondary" class="bg-white/10 text-white">Instagram</Badge>
						<Badge variant="outline" class="border-white/10 text-white/80">
							{currentPost?.schedulingStatus === "scheduled" ? "Agendado" : "Rascunho"}
						</Badge>
						<Badge variant="outline" class="border-white/10 text-white/80">
							{currentPost?.mediaCount ?? 0} mídia{currentPost?.mediaCount === 1 ? "" : "s"}
						</Badge>
					</div>

					<div class="grid grid-cols-2 gap-3 text-sm">
						<div class="border border-white/10 px-4 py-4">
							<p class="text-xs font-medium uppercase tracking-wide text-white/45">Atualizado</p>
							<p class="mt-3 text-base text-white">{currentPost ? formatUpdatedDate(currentPost.updatedAt) : "-"}</p>
						</div>
						<div class="border border-white/10 px-4 py-4">
							<p class="text-xs font-medium uppercase tracking-wide text-white/45">Agendamento</p>
							<p class="mt-3 text-base text-white">
								{currentPost?.scheduledFor ? formatScheduledDate(currentPost.scheduledFor) : "Ainda não agendado"}
							</p>
						</div>
					</div>

					<div class="space-y-2">
						<p class="text-xs font-medium uppercase tracking-wide text-white/45">Legenda</p>
						<div class="border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-white/80">
							{currentPost?.caption || "Sem legenda ainda."}
						</div>
					</div>

					<div class="space-y-2">
						<p class="text-xs font-medium uppercase tracking-wide text-white/45">Próxima ação</p>
						<p class="text-sm leading-7 text-white/65">
							Abra o post na composição para alterar mídia, legenda, projeto ou agendamento sem sair do fluxo de criação.
						</p>
					</div>
				</div>
			</div>
		</aside>
	</div>
</div>
