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

	const DEFAULT_MODEL = IMAGE_MODELS.SEEDREAM_4_5;

	interface Props {
		selected: string[];
		onchange: (models: string[]) => void;
		class?: string;
	}

	let { selected, onchange, class: className }: Props = $props();

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
				"flex w-full items-center gap-3 rounded-none border p-3 text-left transition-all",
				isSelected(model.id)
					? "border-primary bg-primary/5"
					: "border-border bg-background hover:bg-muted/50"
			)}
			onclick={() => toggleModel(model.id)}
		>
			<!-- Model Icon -->
			<div
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm"
				style="background-color: {model.color}20;"
			>
				{#if model.id.includes("gemini") || model.id.includes("google")}
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill={model.color}>
						<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
					</svg>
				{:else if model.id.includes("bytedance") || model.id.includes("seedream")}
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill={model.color}>
						<path d="M3 3v18h18V3H3zm16 16H5V5h14v14zM7 7h4v4H7V7zm6 0h4v4h-4V7zm-6 6h4v4H7v-4zm6 0h4v4h-4v-4z"/>
					</svg>
				{:else if model.id.includes("flux") || model.id.includes("black-forest")}
					<div class="flex h-5 w-5 items-center justify-center rounded-sm bg-gray-800 text-[10px] font-bold text-white">
						F2
					</div>
				{:else if model.id.includes("openai") || model.id.includes("gpt")}
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill={model.color}>
						<path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681v6.722zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
					</svg>
				{:else}
					<div class="h-5 w-5 rounded-sm" style="background-color: {model.color};"></div>
				{/if}
			</div>

			<!-- Model Info -->
			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-2">
					<span class="text-sm font-medium">{model.name}</span>
					{#if model.id === DEFAULT_MODEL}
						<span class="rounded-none bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
							Recomendado
						</span>
					{/if}
				</div>
				<div class="text-xs text-muted-foreground">{model.provider}</div>
			</div>

			<!-- Selection Indicator -->
			<div class="shrink-0">
				{#if isSelected(model.id)}
					<div class="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
						<svg class="h-4 w-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					</div>
				{:else}
					<div class="h-6 w-6 rounded-full border-2 border-muted-foreground/30"></div>
				{/if}
			</div>
		</button>
	{/each}
</div>
