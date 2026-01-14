<script lang="ts">
	import { cn } from "$lib/utils";

	interface Props {
		class?: string;
		size?: "sm" | "md" | "lg";
		showText?: boolean;
	}

	let { class: className, size = "md", showText = true }: Props = $props();

	const sizes = {
		sm: "h-5 w-5",
		md: "h-6 w-6",
		lg: "h-8 w-8",
	};

	const textSizes = {
		sm: "text-base",
		md: "text-lg",
		lg: "text-xl",
	};
</script>

<div class={cn("flex items-center gap-1", className)}>
	<!-- V Logo SVG -->
	<svg 
		class={cn(sizes[size], "shrink-0")} 
		viewBox="0 0 32 32" 
		fill="none" 
		xmlns="http://www.w3.org/2000/svg"
	>
		<defs>
			<linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
				<stop offset="0%" stop-color="#E879B9"/>
				<stop offset="100%" stop-color="#D946A8"/>
			</linearGradient>
		</defs>
		<path d="M4 4L16 28L28 4H22L16 18L10 4H4Z" fill="url(#logoGradient)"/>
	</svg>
	
	{#if showText}
		<span class={cn("font-semibold", textSizes[size])}>anda Studio</span>
	{/if}
</div>
