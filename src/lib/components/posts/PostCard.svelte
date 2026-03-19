<script lang="ts">
	import { Badge } from "$lib/components/ui";

	interface Post {
		_id: string;
		caption: string;
		imageUrl?: string | null;
		status: string;
		scheduledFor?: number;
		schedulingStatus?: string;
		isComposed?: boolean;
		platform?: string;
		createdAt: number;
		projectName?: string;
	}

	interface Props {
		post: Post;
		onclick?: () => void;
	}

	let { post, onclick }: Props = $props();

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

	let statusLabel = $derived.by(() => {
		if (post.schedulingStatus === "scheduled") return "Agendado";
		if (post.schedulingStatus === "posted") return "Publicado";
		if (post.schedulingStatus === "missed") return "Perdido";
		if (post.status === "draft") return "Rascunho";
		return "Gerado";
	});

	let statusVariant = $derived.by((): "default" | "secondary" | "outline" | "destructive" => {
		if (post.schedulingStatus === "scheduled") return "default";
		if (post.schedulingStatus === "posted") return "secondary";
		if (post.schedulingStatus === "missed") return "destructive";
		if (post.status === "draft") return "outline";
		return "secondary";
	});

	let captionPreview = $derived(
		post.caption.replace(/#[\p{L}\p{N}_]+/gu, "").trim().slice(0, 120)
	);
</script>

<button
	type="button"
	class="group overflow-hidden border border-border bg-card text-left transition-all hover:border-primary/40 hover:shadow-sm"
	onclick={onclick}
>
	<!-- Cover image -->
	<div class="relative overflow-hidden bg-muted">
		{#if post.imageUrl}
			<img
				src={post.imageUrl}
				alt=""
				class="w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
				style="aspect-ratio: 4 / 5; object-position: center top;"
				loading="lazy"
				decoding="async"
			/>
		{:else}
			<div class="flex aspect-[4/5] items-center justify-center">
				<svg class="h-10 w-10 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
				</svg>
			</div>
		{/if}

		<!-- Status badge overlay -->
		<div class="absolute left-2 top-2">
			<Badge variant={statusVariant} class="text-[10px]">{statusLabel}</Badge>
		</div>

		<!-- Platform icon -->
		{#if post.platform === "instagram" || post.isComposed}
			<div class="absolute right-2 top-2">
				<div class="flex h-6 w-6 items-center justify-center rounded-none bg-black/60 backdrop-blur-sm">
					<svg class="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
						<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
					</svg>
				</div>
			</div>
		{/if}
	</div>

	<!-- Caption & meta -->
	<div class="p-3 space-y-1.5">
		{#if captionPreview}
			<p class="line-clamp-2 text-xs leading-relaxed text-foreground/80">{captionPreview}</p>
		{:else}
			<p class="text-xs text-muted-foreground italic">Sem legenda</p>
		{/if}

		<div class="flex items-center justify-between gap-2">
			{#if post.schedulingStatus === "scheduled" && post.scheduledFor}
				<span class="text-[10px] text-muted-foreground">{formatScheduledDate(post.scheduledFor)}</span>
			{:else}
				<span class="text-[10px] text-muted-foreground">{formatDate(post.createdAt)}</span>
			{/if}
			{#if post.projectName}
				<span class="max-w-[80px] truncate text-[10px] text-muted-foreground">{post.projectName}</span>
			{/if}
		</div>
	</div>
</button>
