<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		title: string;
		/** Small badges/pills row rendered under the title (platform, status, etc.). */
		badges?: Snippet;
		/** Row of small icon buttons rendered to the right of the title. */
		actions?: Snippet;
	}

	let { title, badges, actions }: Props = $props();
</script>

<div class="border-b border-border/80 px-5 py-5">
	<div class="flex items-start justify-between gap-4">
		<div class="min-w-0">
			<h2 class="truncate text-2xl font-semibold text-foreground">
				{title}
			</h2>
			{#if badges}
				<div class="mt-3 flex flex-wrap items-center gap-2">
					{@render badges()}
				</div>
			{/if}
		</div>

		{#if actions}
			<div class="flex items-center gap-2">
				{@render actions()}
			</div>
		{/if}
	</div>
</div>
