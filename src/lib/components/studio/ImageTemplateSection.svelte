<script lang="ts">
	import { cn } from "$lib/utils";
	import { IMAGE_PRESETS } from "$lib/data/imagePresets";
	import { Layers } from "lucide-svelte";

	let {
		selectedPreset = $bindable<string>("photorealistic"),
	}: {
		selectedPreset?: string;
	} = $props();

	function selectPreset(presetKey: string) {
		selectedPreset = presetKey;
	}
</script>

<div class="space-y-3">
	<p
		class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
	>
		<Layers class="h-3.5 w-3.5" stroke-width={1.5} />
		Estilo
	</p>

	<div class="grid grid-cols-2 gap-1.5">
		{#each IMAGE_PRESETS as preset, index (preset.key)}
			<button
				type="button"
				class={cn(
					"rounded-lg border px-2.5 py-2 text-left transition-all duration-200",
					index === IMAGE_PRESETS.length - 1 ? "col-span-2" : "",
					selectedPreset === preset.key
						? "border-primary/45 bg-primary/[0.07] text-foreground ring-1 ring-primary/15"
						: "border-border/90 bg-transparent text-muted-foreground hover:border-border hover:bg-muted/20 hover:text-foreground"
				)}
				onclick={() => selectPreset(preset.key)}
			>
				<span class="block text-xs font-medium">{preset.label}</span>
				<span class="mt-0.5 block text-[10px] leading-snug text-muted-foreground/75">{preset.sublabel}</span>
			</button>
		{/each}
	</div>
</div>
