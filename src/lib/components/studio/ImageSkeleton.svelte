<script lang="ts">
	import {
		Tooltip,
		TooltipTrigger,
		TooltipContent,
		TooltipProvider,
	} from "$lib/components/ui";
	import ImageGenerationPulseLoader from "./ImageGenerationPulseLoader.svelte";

	interface Props {
		model?: string;
		aspectRatio?: string;
		size?: "full" | "thumbnail";
	}

	let { model, aspectRatio = "1:1", size = "full" }: Props = $props();

	const modelDisplayNames: Record<string, string> = {
		"google/gemini-2.5-flash-image": "Nano Banana",
		"google/gemini-3.1-flash-image-preview": "Nano Banana 2",
		"google/gemini-3-pro-image-preview": "Nano Banana Pro",
		"bytedance-seed/seedream-4.5": "SeeDream v4.5",
		"black-forest-labs/flux.2-flex": "Flux 2 Flex",
		"openai/gpt-5-image": "GPT Image 1.5",
	};

	let displayName = $derived(modelDisplayNames[model ?? ""] ?? model?.split("/").pop() ?? "");

	let ratioNumbers = $derived(aspectRatio.split(":").map(Number));
	let w = $derived(ratioNumbers[0] ?? 1);
	let h = $derived(ratioNumbers[1] ?? 1);

	let loaderMessage = $derived(displayName ? `Gerando com ${displayName}…` : "Gerando imagem…");
</script>

<TooltipProvider>
	<Tooltip>
		<TooltipTrigger>
			{#if size === "thumbnail"}
				<div
					class="group relative flex h-20 w-20 items-center justify-center overflow-hidden border-2 border-dashed border-border bg-muted/40"
				>
					<ImageGenerationPulseLoader
						message={loaderMessage}
						density="thumbnail"
						showBar={false}
						class="pointer-events-none"
					/>
					<div
						class="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-center text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
					>
						{displayName}
					</div>
				</div>
			{:else}
				<div
					class="relative overflow-hidden border border-dashed border-border bg-muted/30"
					style="aspect-ratio: {w} / {h};"
				>
					<div class="absolute inset-0 flex items-center justify-center p-2">
						<ImageGenerationPulseLoader
							message={loaderMessage}
							density="compact"
							class="pointer-events-none"
						/>
					</div>
				</div>
			{/if}
		</TooltipTrigger>
		<TooltipContent>
			<p>Não se preocupe, isso leva alguns segundos</p>
		</TooltipContent>
	</Tooltip>
</TooltipProvider>
