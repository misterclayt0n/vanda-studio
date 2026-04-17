<script lang="ts">
	interface Props {
		label: string;
		value: string;
	}

	let { label, value }: Props = $props();
</script>

<div class="rounded-xl border border-border bg-card/60 p-3">
	<p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
	<p class="mt-2 text-sm font-medium text-foreground">{value}</p>
</div>
