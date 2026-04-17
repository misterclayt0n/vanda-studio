<script lang="ts">
	import type { Id } from "../../../convex/_generated/dataModel.js";
	import MediaLibraryPanel from "./MediaLibraryPanel.svelte";
	import { portal } from "$lib/actions/portal";
	import { DEFAULT_POST_MEDIA_MAX } from "$lib/data/postLimits";

	interface Props {
		open: boolean;
		selectedIds: Id<"media_items">[];
		projectId?: Id<"projects"> | null;
		max?: number;
		onselect: (id: Id<"media_items">) => void;
		ondeselect: (id: Id<"media_items">) => void;
		onclose: () => void;
	}

	let {
		open,
		selectedIds,
		projectId,
		max = DEFAULT_POST_MEDIA_MAX,
		onselect,
		ondeselect,
		onclose,
	}: Props = $props();
</script>

<!-- Portal to body so the sheet renders above the post lightbox (which is z-50). -->
<div use:portal>
	<!-- Backdrop -->
	{#if open}
		<div
			class="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
			role="presentation"
			onclick={onclose}
		></div>
	{/if}

	<!-- Sheet -->
	<div
		class="fixed bottom-0 right-0 top-0 z-[80] flex w-[420px] max-w-[92vw] flex-col border-l border-border bg-background shadow-2xl transition-transform duration-300 {open
			? 'translate-x-0'
			: 'translate-x-full pointer-events-none'}"
	>
	<!-- Header -->
	<div class="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
		<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
			Biblioteca de imagens
		</p>
		<button
			type="button"
			onclick={onclose}
			aria-label="Fechar biblioteca"
			class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
		>
			<svg
				class="h-4 w-4"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.8"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>

	<!-- Panel -->
	<div class="min-h-0 flex-1">
		<MediaLibraryPanel
			{selectedIds}
			projectId={projectId ?? null}
			{max}
			{onselect}
			{ondeselect}
		/>
	</div>
	</div>
</div>
