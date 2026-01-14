<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	type Variant = "default" | "secondary" | "outline" | "destructive";

	interface Props extends HTMLAttributes<HTMLDivElement> {
		variant?: Variant;
		class?: string;
	}

	let { variant = "default", class: className, children, ...rest }: Props = $props();

	const variants: Record<Variant, string> = {
		default: "border-transparent bg-primary text-primary-foreground",
		secondary: "border-transparent bg-secondary text-secondary-foreground",
		outline: "text-foreground border-border",
		destructive: "border-transparent bg-destructive text-destructive-foreground",
	};
</script>

<div
	class={cn(
		"inline-flex items-center rounded-none border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
		variants[variant],
		className
	)}
	{...rest}
>
	{@render children?.()}
</div>
