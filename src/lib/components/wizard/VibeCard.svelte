<script lang="ts">
    import { cn } from "$lib/utils";

    interface Props {
        label: string;
        sublabel: string;
        swatchColors: string[];
        active?: boolean;
        onclick?: () => void;
    }

    let { label, sublabel, swatchColors, active = false, onclick }: Props = $props();
</script>

<button
    type="button"
    class={cn(
        "group relative flex w-full flex-col overflow-hidden border text-left transition-all",
        active
            ? "gradient-border border-transparent ring-1 ring-primary"
            : "border-border bg-card hover:border-muted-foreground/40"
    )}
    {onclick}
>
    <div class="flex h-16 w-full">
        {#each swatchColors as color (color)}
            <div class="flex-1" style="background-color: {color}"></div>
        {/each}
    </div>

    <div class="flex flex-1 flex-col justify-center p-4">
        <h3 class="text-base font-semibold">{label}</h3>
        <p class="mt-1 text-xs text-muted-foreground">{sublabel}</p>
    </div>

    {#if active}
        <div class="absolute right-3 top-[72px] flex h-5 w-5 items-center justify-center bg-primary text-primary-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        </div>
    {/if}
</button>
