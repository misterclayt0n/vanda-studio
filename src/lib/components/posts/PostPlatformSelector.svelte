<script lang="ts">
	import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "$lib/components/ui";

	type PlatformId = "instagram" | "twitter" | "linkedin";

	interface Props {
		value: PlatformId;
		onchange: (platform: PlatformId) => void;
	}

	let { value, onchange }: Props = $props();

	const platforms: Array<{
		id: PlatformId;
		label: string;
		description: string;
		enabled: boolean;
	}> = [
		{
			id: "instagram",
			label: "Instagram",
			description: "Feed e carrossel",
			enabled: true,
		},
		{
			id: "twitter",
			label: "X",
			description: "Em breve",
			enabled: false,
		},
		{
			id: "linkedin",
			label: "LinkedIn",
			description: "Em breve",
			enabled: false,
		},
	];
</script>

<TooltipProvider>
	<div class="flex flex-wrap items-center gap-2">
		{#each platforms as platform}
			{#if platform.enabled}
				<button
					type="button"
					class={`group min-w-[132px] border px-4 py-3 text-left transition ${
						value === platform.id
							? "border-primary bg-primary/10 text-foreground shadow-[0_0_0_1px] shadow-primary/25"
							: "border-border bg-card/70 text-muted-foreground hover:border-primary/35 hover:text-foreground"
					}`}
					onclick={() => onchange(platform.id)}
				>
					<div class="flex items-center justify-between gap-3">
						<span class="text-sm font-medium">{platform.label}</span>
						<span class="h-2.5 w-2.5 rounded-full bg-primary"></span>
					</div>
					<p class="mt-1 text-xs text-muted-foreground">{platform.description}</p>
				</button>
			{:else}
				<Tooltip>
					<TooltipTrigger>
						<button
							type="button"
							class="min-w-[132px] cursor-not-allowed border border-border bg-muted/25 px-4 py-3 text-left text-muted-foreground opacity-75"
							disabled
						>
							<div class="flex items-center justify-between gap-3">
								<span class="text-sm font-medium">{platform.label}</span>
								<span class="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]">
									WIP
								</span>
							</div>
							<p class="mt-1 text-xs text-muted-foreground">{platform.description}</p>
						</button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Suporte a {platform.label} em breve.</p>
					</TooltipContent>
				</Tooltip>
			{/if}
		{/each}
	</div>
</TooltipProvider>
