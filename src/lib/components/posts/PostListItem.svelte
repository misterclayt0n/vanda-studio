<script lang="ts">
	import type { Id } from "../../../convex/_generated/dataModel.js";

	interface PostListItemData {
		_id: Id<"generated_posts">;
		caption: string;
		title?: string;
		projectName?: string;
		schedulingStatus?: string;
		scheduledFor?: number;
		updatedAt: number;
		coverUrl: string | null;
		coverThumbnailUrl?: string | null;
	}

	interface Props {
		post: PostListItemData;
		selected?: boolean;
		selectionMode?: boolean;
		checked?: boolean;
		onclick?: () => void;
		ondelete?: () => void;
		ontoggleselect?: () => void;
	}

	let {
		post,
		selected = false,
		selectionMode = false,
		checked = false,
		onclick,
		ondelete,
		ontoggleselect,
	}: Props = $props();

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString("pt-BR", {
			day: "2-digit",
			month: "short",
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

	let dateLabel = $derived(
		post.schedulingStatus === "scheduled" && post.scheduledFor
			? formatScheduledDate(post.scheduledFor)
			: formatDate(post.updatedAt)
	);

	let statusLabel = $derived(post.schedulingStatus === "scheduled" ? "Agendado" : "Rascunho");

	let captionSnippet = $derived(
		post.caption.replace(/#\S+/g, "").trim().slice(0, 80) || "Sem legenda"
	);

	let primaryLabel = $derived(post.title || post.projectName || "Sem título");
	let secondaryLabel = $derived(post.title ? (post.projectName ?? "Sem projeto") : captionSnippet);
</script>

<div
	class="group relative flex w-full items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/60 {selected
		? 'bg-muted'
		: ''}"
>
	<!-- Checkbox (selection mode) -->
	{#if selectionMode}
		<button
			type="button"
			class="shrink-0"
			onclick={(e) => { e.stopPropagation(); ontoggleselect?.(); }}
			aria-label={checked ? "Desselecionar" : "Selecionar"}
		>
			<div
				class="flex h-5 w-5 items-center justify-center rounded border-2 transition-colors {checked
					? 'border-primary bg-primary'
					: 'border-muted-foreground/40 bg-background'}"
			>
				{#if checked}
					<svg class="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
					</svg>
				{/if}
			</div>
		</button>
	{/if}

	<!-- Main clickable area -->
	<button
		type="button"
		class="flex min-w-0 flex-1 items-center gap-3 text-left"
		onclick={selectionMode ? () => ontoggleselect?.() : onclick}
	>
		<!-- Thumbnail -->
		<div class="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
			{#if post.coverThumbnailUrl ?? post.coverUrl}
				<img
					src={post.coverThumbnailUrl ?? post.coverUrl ?? undefined}
					alt=""
					class="h-full w-full object-cover"
					loading="lazy"
					decoding="async"
				/>
			{:else}
				<div class="flex h-full w-full items-center justify-center">
					<svg
						class="h-5 w-5 text-muted-foreground/40"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909"
						/>
					</svg>
				</div>
			{/if}
		</div>

		<!-- Content -->
		<div class="min-w-0 flex-1">
			<div class="flex items-center justify-between gap-2">
				<p class="truncate text-sm font-medium leading-tight">{primaryLabel}</p>
				<span
					class="shrink-0 text-[10px] font-semibold uppercase tracking-wide {post.schedulingStatus ===
					'scheduled'
						? 'text-primary'
						: 'text-muted-foreground/70'}"
				>
					{statusLabel}
				</span>
			</div>
			<p class="mt-0.5 truncate text-xs text-muted-foreground">{secondaryLabel}</p>
			<p class="mt-0.5 text-[10px] text-muted-foreground/50">{dateLabel}</p>
		</div>
	</button>

	<!-- Delete X button (shown on hover or in selection mode) -->
	{#if !selectionMode && ondelete}
		<button
			type="button"
			class="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground/40 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
			onclick={(e) => { e.stopPropagation(); ondelete(); }}
			aria-label="Excluir post"
		>
			<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	{/if}
</div>
