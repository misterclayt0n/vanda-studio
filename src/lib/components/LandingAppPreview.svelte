<script lang="ts">
	import { onMount } from "svelte";
	import ImageGenerationPulseLoader from "$lib/components/studio/ImageGenerationPulseLoader.svelte";

	const promptText =
		"Gere um retrato da própria Vanda Studio: o V em gradiente rosa, fundo neutro, estética editorial minimalista.";

	type Phase = "typing" | "generating" | "done";

	let phase = $state<Phase>("typing");
	let shownPrompt = $state("");
	let reduceMotion = $state(false);

	let runId = 0;

	function delay(ms: number) {
		return new Promise<void>((resolve) => setTimeout(resolve, ms));
	}

	async function runSequence(signal: AbortSignal) {
		const id = ++runId;
		while (!signal.aborted) {
			if (reduceMotion) {
				shownPrompt = promptText;
				phase = "generating";
				await delay(800);
				if (signal.aborted || id !== runId) return;
				phase = "done";
				await delay(4000);
				if (signal.aborted || id !== runId) return;
				shownPrompt = "";
				phase = "typing";
				continue;
			}

			phase = "typing";
			shownPrompt = "";
			for (let i = 0; i <= promptText.length; i++) {
				if (signal.aborted || id !== runId) return;
				shownPrompt = promptText.slice(0, i);
				await delay(22 + Math.random() * 18);
			}
			await delay(450);
			if (signal.aborted || id !== runId) return;

			phase = "generating";
			await delay(2600);
			if (signal.aborted || id !== runId) return;

			phase = "done";
			await delay(5200);
			if (signal.aborted || id !== runId) return;
		}
	}

	onMount(() => {
		reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const ac = new AbortController();
		void runSequence(ac.signal);
		return () => {
			ac.abort();
			runId++;
		};
	});
</script>

<!-- Fixed outer width + fixed canvas height + absolute phases = no layout jump -->
<div
	class="landing-preview flex w-full max-w-[420px] shrink-0 flex-col border border-border bg-card text-card-foreground shadow-xl shadow-primary/10"
	style="width: min(100%, 420px);"
	aria-label="Demonstração: pedido de geração de imagem no app"
>
	<div class="flex flex-col gap-3 p-3 md:p-4">
		<div
			class="min-h-[6rem] rounded-none border border-border bg-background/80 px-3 py-2.5 text-left text-xs leading-relaxed text-foreground md:text-[13px]"
			aria-live="polite"
		>
			<span class="text-muted-foreground">Você · </span>
			<span>{shownPrompt}</span>
			{#if phase === "typing" && shownPrompt.length > 0 && shownPrompt.length < promptText.length}
				<span class="caret-blink ml-0.5 inline-block h-3 w-px align-middle bg-primary" aria-hidden="true"></span>
			{/if}
		</div>

		<!-- Same box size in every phase (typing / generating / done) -->
		<div
			class="preview-canvas relative h-[280px] w-full overflow-hidden border border-border bg-muted/20 md:h-[300px]"
		>
			<div class="absolute inset-0 flex items-center justify-center p-4" class:invisible={phase !== "typing"}>
				<p class="text-[11px] uppercase tracking-widest text-muted-foreground/70">Aguardando prompt…</p>
			</div>

			<div
				class="absolute inset-0 flex items-center justify-center"
				class:pointer-events-none={phase !== "generating"}
				class:opacity-0={phase !== "generating"}
				class:opacity-100={phase === "generating"}
			>
				<ImageGenerationPulseLoader message="Gerando imagem…" density="compact" showBar={true} class="py-4" />
			</div>

			<div
				class="absolute inset-0 flex items-center justify-center px-4 py-4"
				class:pointer-events-none={phase !== "done"}
				class:opacity-0={phase !== "done"}
				class:opacity-100={phase === "done"}
			>
				<div
					class="result-pop relative flex aspect-square w-[min(78%,200px)] items-center justify-center border-2 border-primary/40 bg-gradient-to-br from-primary/15 via-background to-chart-2/10 md:w-[min(78%,220px)]"
				>
					<svg
						class="h-[46%] w-[46%] max-h-[100px] max-w-[100px] drop-shadow-[0_0_24px_color-mix(in_oklch,var(--primary)_45%,transparent)]"
						viewBox="0 0 32 32"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						aria-hidden="true"
					>
						<defs>
							<linearGradient id="lpSelfV" x1="0%" y1="0%" x2="100%" y2="100%">
								<stop offset="0%" stop-color="#E879B9" />
								<stop offset="100%" stop-color="#D946A8" />
							</linearGradient>
						</defs>
						<path d="M4 4L16 28L28 4H22L16 18L10 4H4Z" fill="url(#lpSelfV)" />
					</svg>
					<span
						class="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground"
					>
						auto-retrato
					</span>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.preview-canvas > .absolute {
		transition: opacity 0.2s ease;
	}

	.preview-canvas > .absolute.invisible {
		visibility: hidden;
	}

	.caret-blink {
		animation: blink 0.9s step-end infinite;
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0;
		}
	}

	/* Opacity-only reveal — no scale/transform (avoids reflow / shift) */
	.result-pop {
		animation: result-in 0.45s ease-out both;
	}

	@keyframes result-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.caret-blink,
		.result-pop {
			animation: none !important;
		}
	}
</style>
