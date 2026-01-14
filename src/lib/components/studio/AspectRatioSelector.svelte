<script lang="ts">
	import { cn } from "$lib/utils";

	// Aspect ratio definitions (mirroring backend)
	const ASPECT_RATIOS = {
		"1:1": { width: 1, height: 1, label: "1:1" },
		"16:9": { width: 16, height: 9, label: "16:9" },
		"9:16": { width: 9, height: 16, label: "9:16" },
		"4:3": { width: 4, height: 3, label: "4:3" },
		"3:4": { width: 3, height: 4, label: "3:4" },
		"21:9": { width: 21, height: 9, label: "21:9" },
	} as const;

	type AspectRatio = keyof typeof ASPECT_RATIOS;

	const ASPECT_RATIO_LIST: AspectRatio[] = ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9"];

	interface Props {
		value: AspectRatio;
		onchange: (ratio: AspectRatio) => void;
		class?: string;
	}

	let { value, onchange, class: className }: Props = $props();

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
</script>

<div class={cn("flex flex-wrap gap-2", className)}>
	{#each ASPECT_RATIO_LIST as ratio (ratio)}
		{@const preview = getPreviewDimensions(ratio)}
		<button
			type="button"
			class={cn(
				"flex flex-col items-center gap-1.5 rounded-none border p-2 transition-all",
				value === ratio
					? "border-primary bg-primary/10 text-primary"
					: "border-border bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground"
			)}
			onclick={() => onchange(ratio)}
		>
			<!-- Visual Preview -->
			<div class="flex h-8 w-10 items-center justify-center">
				<div
					class={cn(
						"rounded-sm border-2 transition-colors",
						value === ratio ? "border-primary" : "border-current"
					)}
					style="width: {preview.width}px; height: {preview.height}px;"
				></div>
			</div>
			<!-- Label -->
			<span class="text-xs font-medium">{ratio}</span>
		</button>
	{/each}
</div>
