<script lang="ts">
    import { cn } from "$lib/utils";
    import { Plus, X } from "lucide-svelte";

    interface ChipOption {
        id: string;
        label: string;
    }

    interface Props {
        options: ChipOption[];
        selected: string[];
        multiple?: boolean;
        onchange?: (selected: string[]) => void;
        allowCustom?: boolean;
        customValues?: string[];
        oncustomchange?: (values: string[]) => void;
        class?: string;
    }

    let {
        options,
        selected = [],
        multiple = true,
        onchange,
        allowCustom = false,
        customValues = [],
        oncustomchange,
        class: className,
    }: Props = $props();

    let showCustomInput = $state(false);
    let customInputValue = $state("");

    function toggle(id: string) {
        let next: string[];
        if (multiple) {
            next = selected.includes(id)
                ? selected.filter((s) => s !== id)
                : [...selected, id];
        } else {
            next = selected.includes(id) ? [] : [id];
        }
        onchange?.(next);
    }

    function addCustom() {
        const val = customInputValue.trim();
        if (!val) return;
        if (!customValues.includes(val)) {
            oncustomchange?.([...customValues, val]);
        }
        customInputValue = "";
        showCustomInput = false;
    }

    function removeCustom(val: string) {
        oncustomchange?.(customValues.filter((v) => v !== val));
    }

    function handleCustomKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            addCustom();
        }
        if (e.key === "Escape") {
            showCustomInput = false;
            customInputValue = "";
        }
    }
</script>

<div class={cn("flex flex-wrap gap-2", className)}>
    {#each options as option (option.id)}
        {@const active = selected.includes(option.id)}
        <button
            type="button"
            class={cn(
                "border px-4 py-2 text-sm font-medium transition-all",
                active
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                    : "border-border bg-card text-foreground hover:border-muted-foreground/40 hover:bg-muted/30"
            )}
            onclick={() => toggle(option.id)}
        >
            {option.label}
        </button>
    {/each}

    <!-- Custom value chips -->
    {#each customValues as val (val)}
        <span class="inline-flex items-center gap-1.5 border border-dashed border-primary/60 bg-primary/5 px-3 py-2 text-sm font-medium text-primary">
            {val}
            <button
                type="button"
                class="text-primary/60 transition-colors hover:text-primary"
                onclick={() => removeCustom(val)}
            >
                <X class="h-3 w-3" />
            </button>
        </span>
    {/each}

    <!-- Add custom button / input -->
    {#if allowCustom}
        {#if showCustomInput}
            <div class="inline-flex items-center border border-border bg-background">
                <input
                    type="text"
                    class="h-9 w-32 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
                    placeholder="Digite..."
                    bind:value={customInputValue}
                    onkeydown={handleCustomKeydown}
                    onblur={() => { if (!customInputValue.trim()) showCustomInput = false; }}
                />
                <button
                    type="button"
                    class="px-2 text-muted-foreground transition-colors hover:text-foreground"
                    onclick={addCustom}
                >
                    <Plus class="h-4 w-4" />
                </button>
            </div>
        {:else}
            <button
                type="button"
                class="inline-flex items-center gap-1.5 border border-dashed border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                onclick={() => (showCustomInput = true)}
            >
                <Plus class="h-3.5 w-3.5" />
                Outro
            </button>
        {/if}
    {/if}
</div>
