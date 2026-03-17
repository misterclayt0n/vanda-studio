<script lang="ts">
	import { cn } from "$lib/utils";

	// Model definitions (mirroring backend)
	const IMAGE_MODELS = {
		NANO_BANANA: "google/gemini-2.5-flash-image",
		NANO_BANANA_PRO: "google/gemini-3-pro-image-preview",
		SEEDREAM_4_5: "bytedance-seed/seedream-4.5",
		FLUX_2_FLEX: "black-forest-labs/flux.2-flex",
		GPT_IMAGE_1_5: "openai/gpt-5-image",
	} as const;

	type ImageModelId = (typeof IMAGE_MODELS)[keyof typeof IMAGE_MODELS];

	interface ModelInfo {
		id: ImageModelId;
		name: string;
		provider: string;
		color: string;
	}

	const MODELS_LIST: ModelInfo[] = [
		{
			id: IMAGE_MODELS.NANO_BANANA,
			name: "Nano Banana",
			provider: "Google",
			color: "#FACC15",
		},
		{
			id: IMAGE_MODELS.NANO_BANANA_PRO,
			name: "Nano Banana Pro",
			provider: "Google",
			color: "#FACC15",
		},
		{
			id: IMAGE_MODELS.SEEDREAM_4_5,
			name: "SeeDream v4.5",
			provider: "ByteDance",
			color: "#8B5CF6",
		},
		{
			id: IMAGE_MODELS.FLUX_2_FLEX,
			name: "Flux 2 Flex",
			provider: "BFL",
			color: "#1F2937",
		},
		{
			id: IMAGE_MODELS.GPT_IMAGE_1_5,
			name: "GPT Image 1.5",
			provider: "OpenAI",
			color: "#EC4899",
		},
	];

	const DEFAULT_MODEL = IMAGE_MODELS.NANO_BANANA_PRO;

	interface Props {
		selected: string[];
		onchange: (models: string[]) => void;
		class?: string;
		compact?: boolean;
	}

	let { selected, onchange, class: className, compact = false }: Props = $props();

	function toggleModel(modelId: string) {
		if (selected.includes(modelId)) {
			// Don't allow deselecting if it's the last one
			if (selected.length > 1) {
				onchange(selected.filter((m) => m !== modelId));
			}
		} else {
			onchange([...selected, modelId]);
		}
	}

	function isSelected(modelId: string): boolean {
		return selected.includes(modelId);
	}
</script>

<div class={cn("space-y-2", className)}>
	{#each MODELS_LIST as model (model.id)}
		<button
			type="button"
			class={cn(
				compact
					? "flex min-h-[58px] w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all"
					: "flex w-full items-center gap-3 rounded-none border p-3 text-left transition-all",
				isSelected(model.id)
					? "border-primary bg-primary/5"
					: "border-border bg-background hover:bg-muted/50"
			)}
			onclick={() => toggleModel(model.id)}
		>
			<!-- Model Info -->
			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-2">
					<span class={cn("font-medium", compact ? "text-[14px] leading-tight" : "text-sm")}>{model.name}</span>
					{#if model.id === DEFAULT_MODEL}
						<span class={cn(
							"bg-primary/10 font-medium text-primary",
							compact ? "ml-auto rounded-full px-1.5 py-0.5 text-[8px]" : "rounded-none px-1.5 py-0.5 text-[10px]"
						)}>
							Recomendado
						</span>
					{/if}
				</div>
				<div class={cn("text-muted-foreground", compact ? "text-[12px] leading-tight" : "text-xs")}>{model.provider}</div>
			</div>

			<!-- Selection Indicator -->
			<div class="shrink-0">
				{#if isSelected(model.id)}
					<div class={cn(
						"flex items-center justify-center rounded-full bg-primary",
						compact ? "h-5 w-5" : "h-6 w-6"
					)}>
						<svg class={cn("text-primary-foreground", compact ? "h-3 w-3" : "h-4 w-4")} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					</div>
				{:else}
					<div class={cn(
						"rounded-full border-2 border-muted-foreground/30",
						compact ? "h-5 w-5" : "h-6 w-6"
					)}></div>
				{/if}
			</div>
		</button>
	{/each}
</div>
