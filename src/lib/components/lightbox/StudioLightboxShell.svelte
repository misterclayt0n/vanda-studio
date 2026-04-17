<script lang="ts">
	import type { Snippet } from "svelte";
	import LightboxNavArrows from "./LightboxNavArrows.svelte";

	interface Props {
		ariaLabel: string;
		counterText: string;
		onclose: () => void;
		canPrev: boolean;
		canNext: boolean;
		onprev: () => void;
		onnext: () => void;
		prevAriaLabel?: string;
		nextAriaLabel?: string;
		/** When false, main pane spans full width (e.g. no metadata column). */
		hasSidebar?: boolean;
		main: Snippet;
		/** Omitted when `hasSidebar` is false. */
		sidebar?: Snippet | undefined;
	}

	let {
		ariaLabel,
		counterText,
		onclose,
		canPrev,
		canNext,
		onprev,
		onnext,
		prevAriaLabel = "Anterior",
		nextAriaLabel = "Próximo",
		hasSidebar = true,
		main,
		sidebar,
	}: Props = $props();

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onclose();
		}
	}

	$effect(() => {
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "";
		};
	});
</script>

<div
	class="fixed inset-0 z-50 flex max-h-[100dvh] flex-col overflow-hidden animate-in fade-in duration-150"
	role="dialog"
	aria-modal="true"
	aria-label={ariaLabel}
>
	<div
		class="absolute inset-0 bg-black/90"
		role="button"
		tabindex="-1"
		aria-label="Fechar visualizador"
		onclick={handleBackdropClick}
		onkeydown={(event) => event.key === "Enter" && onclose()}
	></div>

	<button
		type="button"
		aria-label="Fechar"
		class="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur-sm transition hover:text-white"
		onclick={onclose}
	>
		<svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
		</svg>
	</button>

	<div class="pointer-events-none absolute left-4 top-4 z-10 text-sm text-white/70">
		<span>{counterText}</span>
	</div>

	<div class="relative z-0 flex min-h-0 flex-1 w-full flex-row overflow-hidden">
		<div class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-black/60">
			<LightboxNavArrows
				{canPrev}
				{canNext}
				{onprev}
				{onnext}
				{prevAriaLabel}
				{nextAriaLabel}
			/>
			<div class="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden">
				{@render main()}
			</div>
		</div>

		{#if hasSidebar && sidebar}
			<aside
				class="flex min-h-0 w-[420px] shrink-0 flex-col overflow-hidden border-l border-white/10 bg-background/95 text-foreground backdrop-blur-md"
			>
				{@render sidebar()}
			</aside>
		{/if}
	</div>
</div>
