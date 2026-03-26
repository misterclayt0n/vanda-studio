<script lang="ts">
    import { cn } from "$lib/utils";
    import { Button } from "$lib/components/ui";
    import { fly } from "svelte/transition";
    import type { Snippet } from "svelte";

    interface Props {
        step: number;
        totalSteps: number;
        title: string;
        subtitle?: string;
        onback?: (() => void) | undefined;
        onnext?: (() => void) | undefined;
        nextLabel?: string;
        nextDisabled?: boolean;
        showBack?: boolean;
        children: Snippet;
        actions?: Snippet;
    }

    let {
        step,
        totalSteps,
        title,
        subtitle,
        onback,
        onnext,
        nextLabel = "Continuar",
        nextDisabled = false,
        showBack = true,
        children,
        actions,
    }: Props = $props();

    let progress = $derived(((step + 1) / totalSteps) * 100);
</script>

<div class="flex w-full flex-col gap-10">
    <!-- Progress bar — thin continuous bar -->
    <div class="space-y-3">
        <div class="relative h-[2px] w-full bg-border/50 overflow-hidden">
            <div
                class="absolute inset-y-0 left-0 bg-primary transition-all duration-500 ease-out"
                style="width: {progress}%"
            ></div>
        </div>
        <div class="flex items-baseline justify-between gap-4">
            <div>
                <h1 class="text-2xl font-semibold tracking-tight">{title}</h1>
                {#if subtitle}
                    <p class="mt-2 text-sm text-muted-foreground/80">{subtitle}</p>
                {/if}
            </div>
            <span class="shrink-0 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/40">
                {step + 1} / {totalSteps}
            </span>
        </div>
    </div>

    <!-- Step content with transition -->
    {#key step}
        <div in:fly={{ x: 40, duration: 250, delay: 80 }} out:fly={{ x: -40, duration: 150 }}>
            {@render children()}
        </div>
    {/key}

    <!-- Navigation -->
    <div class="flex items-center justify-between gap-3">
        <div>
            {#if showBack && step > 0}
                <Button variant="outline" onclick={onback}>Voltar</Button>
            {/if}
        </div>
        <div class="flex items-center gap-3">
            {#if actions}
                {@render actions()}
            {/if}
            {#if onnext}
                <Button onclick={onnext} disabled={nextDisabled}>
                    {nextLabel}
                </Button>
            {/if}
        </div>
    </div>
</div>
