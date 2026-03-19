<script lang="ts">
	import type { Id } from "../../../convex/_generated/dataModel.js";
	import MediaLibraryPanel from "./MediaLibraryPanel.svelte";

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
		max = 10,
		onselect,
		ondeselect,
		onclose,
	}: Props = $props();
</script>

<!-- Backdrop -->
{#if open}
	<div
		class="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
		role="presentation"
		onclick={onclose}
	></div>
{/if}

<!-- Sheet -->
<div
	class="fixed bottom-0 right-0 top-14 z-40 flex w-[380px] flex-col border-l border-border bg-background shadow-xl transition-transform duration-300 {open
		? 'translate-x-0'
		: 'translate-x-full'}"
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
