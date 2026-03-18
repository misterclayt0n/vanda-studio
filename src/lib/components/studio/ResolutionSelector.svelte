<script lang="ts">
	import { cn } from "$lib/utils";
	import {
		RESOLUTION_LIST,
		type Resolution,
	} from "$lib/studio/imageGenerationCapabilities";

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

	const DEFAULT_RESOLUTION: Resolution = "standard";

	interface Props {
		value: Resolution;
		onchange: (resolution: Resolution) => void;
		supportedValues?: Resolution[];
		class?: string;
		compact?: boolean;
	}

	let {
		value,
		onchange,
		supportedValues = RESOLUTION_LIST,
		class: className,
		compact = false,
	}: Props = $props();

	function isSupported(resolution: Resolution): boolean {
		return supportedValues.includes(resolution);
	}
</script>

<div class={cn("grid grid-cols-3 gap-2", className)}>
	{#each RESOLUTION_LIST as resolution (resolution)}
		{@const info = RESOLUTIONS[resolution]}
		{@const supported = isSupported(resolution)}
		<button
			type="button"
			disabled={!supported}
			aria-disabled={!supported}
			title={!supported ? "Nao compativel com os modelos selecionados" : undefined}
			class={cn(
				compact
					? "flex flex-1 flex-col items-center gap-0.5 rounded-lg border px-2 py-2 transition-all"
					: "flex flex-1 flex-col items-center gap-0.5 rounded-none border px-3 py-2 transition-all",
				!supported
					? "cursor-not-allowed border-border/50 bg-background/50 opacity-45"
					: value === resolution
					? "border-primary bg-primary/10"
					: "border-border bg-background hover:bg-muted/50"
			)}
			onclick={() => supported && onchange(resolution)}
		>
			<div class="flex items-center gap-1.5">
				<span
					class={cn(
						compact ? "text-[13px] font-medium" : "text-sm font-medium",
						!supported ? "text-muted-foreground/50" : value === resolution ? "text-primary" : "text-foreground"
					)}
				>
					{info.label}
				</span>
				{#if resolution === DEFAULT_RESOLUTION && !compact}
					<span class={cn(
						"bg-primary/10 px-1 py-0.5 font-medium text-primary",
						compact ? "rounded-full text-[8px]" : "rounded-none text-[9px]"
					)}>
						Padrão
					</span>
				{/if}
			</div>
			<span
				class={cn(
					compact ? "text-[10px]" : "text-xs",
					!supported ? "text-muted-foreground/40" : value === resolution ? "text-primary/70" : "text-muted-foreground"
				)}
			>
				{compact ? info.description.replace(" resolution", "") : info.description}
			</span>
		</button>
	{/each}
</div>
