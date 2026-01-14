<script lang="ts">
	import { cn } from "$lib/utils";

	interface Props {
		class?: string;
		size?: "sm" | "md" | "lg";
	}

	let { class: className, size = "md" }: Props = $props();

	const textSizes = {
		sm: "text-base",
		md: "text-lg",
		lg: "text-xl",
	};
</script>

<h1 class={cn("font-semibold", textSizes[size], className)}>
	<span class="font-serif bg-gradient-to-br from-[#E879B9] to-[#D946A8] bg-clip-text text-transparent">V</span>anda Studio
</h1>
