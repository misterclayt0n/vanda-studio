<script lang="ts">
	import { cn } from "$lib/utils";
	import { Sparkles } from "lucide-svelte";

	interface Props {
		/** Primary status line */
		message?: string;
		/** comfortable = post overlay; compact = cards; thumbnail = tiny tiles */
		density?: "comfortable" | "compact" | "thumbnail";
		class?: string;
		showBar?: boolean;
	}

	let {
		message = "Gerando imagem…",
		density = "comfortable",
		class: className = "",
		showBar = true,
	}: Props = $props();

	let showProgressBar = $derived(showBar && density !== "thumbnail");
</script>

<div
	class={cn(
		"flex flex-col items-center justify-center text-center",
		density === "comfortable" && "gap-4",
		density === "compact" && "gap-2 px-1",
		density === "thumbnail" && "gap-1",
		className
	)}
>
	{#if density === "thumbnail"}
		<div class="pulse-glow flex h-8 w-8 items-center justify-center text-primary">
			<Sparkles class="h-4 w-4" stroke-width={1.5} />
		</div>
	{:else if density === "compact"}
		<div class="pulse-glow flex h-10 w-10 items-center justify-center text-primary">
			<Sparkles class="h-6 w-6" stroke-width={1.5} />
		</div>
	{:else}
		<div class="pulse-glow flex h-12 w-12 items-center justify-center text-primary">
			<Sparkles class="h-8 w-8" stroke-width={1.5} />
		</div>
	{/if}

	<p
		class={cn(
			"max-w-[240px] text-muted-foreground animate-pulse",
			density === "comfortable" && "text-sm",
			density === "compact" && "text-xs leading-snug",
			density === "thumbnail" && "sr-only"
		)}
	>
		{message}
	</p>

	{#if showProgressBar}
		<div
			class={cn(
				"h-1 overflow-hidden rounded-full bg-border",
				density === "comfortable" && "w-40",
				density === "compact" && "w-24"
			)}
		>
			<div
				class="h-full w-1/2 animate-[indeterminate_1.5s_ease-in-out_infinite] bg-primary"
			></div>
		</div>
	{/if}
</div>

<style>
	@keyframes indeterminate {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(200%);
		}
	}
</style>
