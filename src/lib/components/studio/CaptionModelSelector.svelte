<script lang="ts">
	import { cn } from "$lib/utils";
	import { getCaptionModelCreditInfo } from "$lib/billing/aiCredits";

	// Caption model definitions (mirroring backend)
	const CAPTION_MODELS = {
		KIMI_K2: "moonshotai/kimi-k2-0905",
		GPT_4_1: "openai/gpt-4.1",
		GEMINI_2_5_FLASH: "google/gemini-2.5-flash",
	} as const;

	type CaptionModelId = (typeof CAPTION_MODELS)[keyof typeof CAPTION_MODELS];

	interface ModelInfo {
		id: CaptionModelId;
		name: string;
		provider: string;
	}

	const MODELS_LIST: ModelInfo[] = [
		{
			id: CAPTION_MODELS.KIMI_K2,
			name: "Kimi K2",
			provider: "Moonshot",
		},
		{
			id: CAPTION_MODELS.GPT_4_1,
			name: "GPT 4.1",
			provider: "OpenAI",
		},
		{
			id: CAPTION_MODELS.GEMINI_2_5_FLASH,
			name: "Flash 2.5",
			provider: "Google",
		},
	];

	const DEFAULT_MODEL = CAPTION_MODELS.KIMI_K2;

	interface Props {
		value: string;
		onchange: (model: string) => void;
		class?: string;
		compact?: boolean;
		monthlyIncludedCredits?: number | null;
		usageIndicatorMode?: "credits" | "percent";
	}

	let {
		value,
		onchange,
		class: className,
		compact = false,
		monthlyIncludedCredits = null,
		usageIndicatorMode = "credits",
	}: Props = $props();

	function selectModel(modelId: string) {
		onchange(modelId);
	}

	function isSelected(modelId: string): boolean {
		return value === modelId;
	}

	function getUsageIndicator(modelId: string): string {
		const creditInfo = getCaptionModelCreditInfo(modelId);

		if (usageIndicatorMode === "credits") {
			return creditInfo.shortLabel;
		}

		if (monthlyIncludedCredits === null || monthlyIncludedCredits === undefined) {
			return "···";
		}

		if (monthlyIncludedCredits <= 0) {
			return "0%";
		}

		const percent = (creditInfo.credits / monthlyIncludedCredits) * 100;
		const formatter = new Intl.NumberFormat("pt-BR", {
			minimumFractionDigits: Number.isInteger(percent) ? 0 : 1,
			maximumFractionDigits: 1,
		});

		return `${formatter.format(percent)}%`;
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
			onclick={() => selectModel(model.id)}
		>
			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-2">
					<span class={cn("font-medium", compact ? "text-[14px] leading-tight" : "text-sm")}>
						{model.name}
					</span>
					{#if model.id === DEFAULT_MODEL}
						<span
							class={cn(
								"bg-primary/10 font-medium text-primary",
								compact
									? "ml-auto rounded-full px-1.5 py-0.5 text-[8px]"
									: "rounded-none px-1.5 py-0.5 text-[10px]"
							)}
						>
							Recomendado
						</span>
					{/if}
				</div>
				<div
					class={cn("text-muted-foreground", compact ? "text-[12px] leading-tight" : "text-xs")}
				>
					{model.provider}
				</div>
			</div>

			<div class="shrink-0">
				<div
					class={cn(
						"rounded-full border border-border/70 bg-muted/40 px-2 py-1 font-medium text-foreground",
						compact ? "text-[10px]" : "text-[11px]"
					)}
				>
					{getUsageIndicator(model.id)}
				</div>
			</div>

			<div class="shrink-0">
				{#if isSelected(model.id)}
					<div
						class={cn(
							"flex items-center justify-center rounded-full bg-primary",
							compact ? "h-5 w-5" : "h-6 w-6"
						)}
					>
						<svg
							class={cn("text-primary-foreground", compact ? "h-3 w-3" : "h-4 w-4")}
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2.5"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					</div>
				{:else}
					<div
						class={cn(
							"rounded-full border-2 border-muted-foreground/30",
							compact ? "h-5 w-5" : "h-6 w-6"
						)}
					></div>
				{/if}
			</div>
		</button>
	{/each}
</div>
