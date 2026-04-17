<script lang="ts">
	interface Props {
		canPrev: boolean;
		canNext: boolean;
		onprev: () => void;
		onnext: () => void;
		prevAriaLabel?: string;
		nextAriaLabel?: string;
	}

	let {
		canPrev,
		canNext,
		onprev,
		onnext,
		prevAriaLabel = "Anterior",
		nextAriaLabel = "Próximo",
	}: Props = $props();
</script>

{#if canPrev}
	<button
		type="button"
		aria-label={prevAriaLabel}
		class="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
		onclick={onprev}
	>
		<svg
			class="h-6 w-6"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="2"
			stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
		</svg>
	</button>
{/if}

{#if canNext}
	<button
		type="button"
		aria-label={nextAriaLabel}
		class="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
		onclick={onnext}
	>
		<svg
			class="h-6 w-6"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="2"
			stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
		</svg>
	</button>
{/if}
