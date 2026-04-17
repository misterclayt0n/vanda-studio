<script lang="ts">
	import { Badge, Button } from "$lib/components/ui";
	import { useQuery } from "convex-svelte";
	import { api } from "../../../convex/_generated/api.js";
	import type { Id } from "../../../convex/_generated/dataModel.js";
	import { portal } from "$lib/actions/portal";
	import { INSTAGRAM_CAROUSEL_MAX, remainingPostSlots } from "$lib/data/postLimits";

	type PostCard = {
		_id: Id<"generated_posts">;
		caption: string;
		title?: string;
		platform?: string;
		status: string;
		projectId?: Id<"projects">;
		projectName?: string;
		scheduledFor?: number;
		schedulingStatus?: string;
		updatedAt: number;
		mediaCount: number;
		coverUrl: string | null;
		coverThumbnailUrl?: string | null;
	};

	interface Props {
		open: boolean;
		mediaCount: number;
		onclose: () => void;
		onselect: (postId: Id<"generated_posts">) => void;
	}

	let { open, mediaCount, onclose, onselect }: Props = $props();

	const postsQuery = useQuery(
		api.generatedPosts.listCardsByUser,
		() => (open ? { limit: 60 } : "skip")
	);
	let posts = $derived((postsQuery.data ?? []) as PostCard[]);
	let searchQuery = $state("");

	let filteredPosts = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return posts;
		return posts.filter((p) => {
			const hay = `${p.title ?? ""} ${p.projectName ?? ""} ${p.caption}`.toLowerCase();
			return hay.includes(q);
		});
	});

	function platformLabel(platform?: string): string {
		if (platform === "twitter") return "X";
		if (platform === "linkedin") return "LinkedIn";
		return "Instagram";
	}

	function statusLabel(schedulingStatus?: string): string {
		if (schedulingStatus === "scheduled") return "Agendado";
		if (schedulingStatus === "posted") return "Publicado";
		return "Rascunho";
	}

	function formatRelative(timestamp: number): string {
		const diff = Date.now() - timestamp;
		if (diff < 60_000) return "Agora";
		if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)} min`;
		if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / 3_600_000)} h`;
		if (diff < 7 * 24 * 60 * 60_000) return `${Math.floor(diff / 86_400_000)} d`;
		return new Date(timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === "Escape") {
			event.preventDefault();
			onclose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div use:portal>
		<div
			class="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
			role="presentation"
			onclick={(e) => {
				if (e.target === e.currentTarget) onclose();
			}}
		>
			<div
				class="relative flex max-h-[min(80vh,640px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
				role="dialog"
				aria-modal="true"
				aria-label="Adicionar imagens a um post"
			>
				<header class="shrink-0 border-b border-border px-5 py-4">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
								Adicionar a post existente
							</p>
							<h2 class="mt-1.5 text-lg font-semibold text-foreground">
								Escolha um post
							</h2>
							<p class="mt-0.5 text-xs text-muted-foreground">
								{mediaCount} {mediaCount === 1 ? "imagem" : "imagens"} selecionada{mediaCount === 1 ? "" : "s"} ·
								serão anexadas ao final do carrossel.
							</p>
						</div>
						<button
							type="button"
							onclick={onclose}
							aria-label="Fechar"
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
						>
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<div class="relative mt-4">
						<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
							</svg>
						</span>
						<input
							type="search"
							placeholder="Buscar post…"
							class="h-9 w-full border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							bind:value={searchQuery}
						/>
					</div>
				</header>

				<div class="min-h-0 flex-1 overflow-y-auto">
					{#if postsQuery.isLoading}
						<div class="flex items-center justify-center p-10 text-sm text-muted-foreground">
							Carregando posts…
						</div>
					{:else if filteredPosts.length === 0}
						<div class="flex flex-col items-center justify-center gap-2 p-10 text-center">
							<p class="text-sm font-medium text-foreground">Nenhum post encontrado</p>
							<p class="text-xs text-muted-foreground">
								{searchQuery.trim()
									? "Ajuste a busca ou escolha outro post."
									: "Crie um post primeiro para vincular imagens."}
							</p>
						</div>
					{:else}
						<ul class="divide-y divide-border/60">
							{#each filteredPosts as post (post._id)}
								{@const slotsLeft = remainingPostSlots(post.mediaCount)}
								{@const willFit = Math.min(mediaCount, slotsLeft)}
								{@const isFull = slotsLeft === 0}
								{@const needsTrimming = mediaCount > slotsLeft && !isFull}
								<li>
									<button
										type="button"
										class="flex w-full items-center gap-3 px-5 py-3 text-left transition {isFull
											? 'cursor-not-allowed opacity-60'
											: 'hover:bg-muted/50'}"
										disabled={isFull}
										title={isFull
											? `Este post já está no limite de ${INSTAGRAM_CAROUSEL_MAX} mídias do Instagram.`
											: needsTrimming
												? `Só cabem mais ${slotsLeft} mídia${slotsLeft === 1 ? "" : "s"} neste post. As primeiras ${willFit} da sua seleção serão adicionadas.`
												: ""}
										onclick={() => {
											if (!isFull) onselect(post._id);
										}}
									>
										<div class="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
											{#if post.coverThumbnailUrl ?? post.coverUrl}
												<img
													src={post.coverThumbnailUrl ?? post.coverUrl ?? undefined}
													alt=""
													class="h-full w-full object-cover"
													loading="lazy"
												/>
											{:else}
												<div class="flex h-full w-full items-center justify-center text-muted-foreground/60">
													<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159" />
													</svg>
												</div>
											{/if}
										</div>
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-semibold text-foreground">
												{post.title?.trim() || post.projectName || "Sem título"}
											</p>
											<div class="mt-0.5 flex flex-wrap items-center gap-1.5">
												<Badge variant="secondary" class="text-[10px]">{platformLabel(post.platform)}</Badge>
												<Badge variant="secondary" class="text-[10px]">{statusLabel(post.schedulingStatus)}</Badge>
												<span class="text-[11px] text-muted-foreground">
													{post.mediaCount}/{INSTAGRAM_CAROUSEL_MAX} · {formatRelative(post.updatedAt)}
												</span>
											</div>
											{#if isFull}
												<p class="mt-1 text-[11px] font-medium text-destructive">
													Cheio — remova mídias no post para liberar espaço.
												</p>
											{:else if needsTrimming}
												<p class="mt-1 text-[11px] font-medium text-amber-500">
													Só cabem mais {slotsLeft} aqui — as primeiras {willFit} da sua seleção serão adicionadas.
												</p>
											{:else}
												<p class="mt-1 text-[11px] text-muted-foreground">
													Cabem todas as {mediaCount} selecionada{mediaCount === 1 ? "" : "s"} ({slotsLeft} vaga{slotsLeft === 1 ? "" : "s"} livres).
												</p>
											{/if}
										</div>
										<svg class="h-4 w-4 shrink-0 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
										</svg>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				<footer class="shrink-0 border-t border-border px-5 py-3">
					<div class="flex items-center justify-end">
						<Button variant="ghost" size="sm" onclick={onclose}>Cancelar</Button>
					</div>
				</footer>
			</div>
		</div>
	</div>
{/if}
