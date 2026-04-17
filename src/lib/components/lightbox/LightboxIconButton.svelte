<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		ariaLabel: string;
		onclick: () => void;
		icon: Snippet;
	}

	let { ariaLabel, onclick, icon }: Props = $props();
</script>

<button
	type="button"
	aria-label={ariaLabel}
	class="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-muted"
	{onclick}
>
	{@render icon()}
</button>
