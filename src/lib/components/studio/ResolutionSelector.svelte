<script lang="ts">
	import { cn } from "$lib/utils";

	// Resolution definitions (mirroring backend)
	const RESOLUTIONS = {
		standard: {
			label: "Standard",
			description: "1K resolution",
		},
		high: {
			label: "High",
			description: "2K resolution",
		},
		ultra: {
			label: "Ultra",
			description: "4K resolution",
		},
	} as const;

	type Resolution = keyof typeof RESOLUTIONS;

	const RESOLUTION_LIST: Resolution[] = ["standard", "high", "ultra"];
	const DEFAULT_RESOLUTION: Resolution = "standard";

	interface Props {
		value: Resolution;
		onchange: (resolution: Resolution) => void;
		class?: string;
	}

	let { value, onchange, class: className }: Props = $props();
</script>

<div class={cn("flex gap-2", className)}>
	{#each RESOLUTION_LIST as resolution (resolution)}
		{@const info = RESOLUTIONS[resolution]}
		<button
			type="button"
			class={cn(
				"flex flex-1 flex-col items-center gap-0.5 rounded-none border px-3 py-2 transition-all",
				value === resolution
					? "border-primary bg-primary/10"
					: "border-border bg-background hover:bg-muted/50"
			)}
			onclick={() => onchange(resolution)}
		>
			<div class="flex items-center gap-1.5">
				<span
					class={cn(
						"text-sm font-medium",
						value === resolution ? "text-primary" : "text-foreground"
					)}
				>
					{info.label}
				</span>
				{#if resolution === DEFAULT_RESOLUTION}
					<span class="rounded-none bg-primary/10 px-1 py-0.5 text-[9px] font-medium text-primary">
						Padrão
					</span>
				{/if}
			</div>
			<span
				class={cn(
					"text-xs",
					value === resolution ? "text-primary/70" : "text-muted-foreground"
				)}
			>
				{info.description}
			</span>
		</button>
	{/each}
</div>
