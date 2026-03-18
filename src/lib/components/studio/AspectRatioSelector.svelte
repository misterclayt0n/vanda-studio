<script lang="ts">
	import { cn } from "$lib/utils";
	import {
		ASPECT_RATIO_LIST,
		type AspectRatio,
	} from "$lib/studio/imageGenerationCapabilities";

	const ASPECT_RATIOS = {
		"1:1": { width: 1, height: 1, label: "1:1" },
		"16:9": { width: 16, height: 9, label: "16:9" },
		"9:16": { width: 9, height: 16, label: "9:16" },
		"4:3": { width: 4, height: 3, label: "4:3" },
		"3:4": { width: 3, height: 4, label: "3:4" },
		"21:9": { width: 21, height: 9, label: "21:9" },
	} as const;

	const DEFAULT_ASPECT_RATIO: AspectRatio = "1:1";

	interface Props {
		value: AspectRatio;
		onchange: (ratio: AspectRatio) => void;
		supportedValues?: AspectRatio[];
		class?: string;
		compact?: boolean;
	}

	let {
		value,
		onchange,
		supportedValues = ASPECT_RATIO_LIST,
		class: className,
		compact = false,
	}: Props = $props();

	/**
	 * Calculate the visual preview dimensions for the aspect ratio button
	 * Scales to fit within a 32x32 container
	 */
	function getPreviewDimensions(ratio: AspectRatio): { width: number; height: number } {
		const { width: w, height: h } = ASPECT_RATIOS[ratio];
		const maxSize = 28; // Max dimension in pixels
		const scale = maxSize / Math.max(w, h);
		return {
			width: Math.round(w * scale),
			height: Math.round(h * scale),
		};
	}

	function isSupported(ratio: AspectRatio): boolean {
		return supportedValues.includes(ratio);
	}
</script>

<div class={cn(compact ? "grid grid-cols-6 gap-1.5" : "flex flex-wrap gap-2", className)}>
	{#each ASPECT_RATIO_LIST as ratio (ratio)}
		{@const preview = getPreviewDimensions(ratio)}
		{@const supported = isSupported(ratio)}
		<button
			type="button"
			disabled={!supported}
			aria-disabled={!supported}
			title={!supported ? "Nao compativel com os modelos selecionados" : undefined}
			class={cn(
				compact
					? "flex min-w-0 flex-col items-center gap-1 rounded-md border px-1.5 py-1.5 transition-all"
					: "flex flex-col items-center gap-1.5 rounded-none border p-2 transition-all",
				!supported
					? "cursor-not-allowed border-border/50 bg-background/50 text-muted-foreground/40 opacity-45"
					: value === ratio
					? "border-primary bg-primary/10 text-primary"
					: "border-border bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground"
			)}
			onclick={() => supported && onchange(ratio)}
		>
			<!-- Visual Preview -->
			<div class={cn("flex items-center justify-center", compact ? "h-6 w-7" : "h-8 w-10")}>
				<div
					class={cn(
						"rounded-sm border-2 transition-colors",
						!supported ? "border-current/50" : value === ratio ? "border-primary" : "border-current"
					)}
					style="width: {preview.width}px; height: {preview.height}px;"
				></div>
			</div>
			<!-- Label -->
			<div class="flex flex-col items-center gap-0.5">
				<span class={cn("font-medium", compact ? "text-[10px] leading-none" : "text-xs")}>{ratio}</span>
				{#if ratio === DEFAULT_ASPECT_RATIO}
					<span class={cn("text-muted-foreground", compact ? "text-[7px] leading-none" : "text-[9px]")}>Padrão</span>
				{/if}
			</div>
		</button>
	{/each}
</div>
