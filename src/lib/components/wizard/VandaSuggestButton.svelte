<script lang="ts">
    import { cn } from "$lib/utils";
    import { Sparkles } from "lucide-svelte";

    interface Props {
        loading?: boolean;
        disabled?: boolean;
        onclick?: () => void;
        label?: string;
        class?: string;
    }

    let {
        loading = false,
        disabled = false,
        onclick,
        label = "Vanda sugere",
        class: className,
    }: Props = $props();
</script>

<button
    type="button"
    class={cn(
        "inline-flex items-center gap-2 border border-input bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
        loading && "pulse-glow",
        className
    )}
    disabled={loading || disabled}
    {onclick}
>
    <Sparkles class="h-3.5 w-3.5" />
    {#if loading}
        Gerando…
    {:else}
        {label}
    {/if}
</button>
