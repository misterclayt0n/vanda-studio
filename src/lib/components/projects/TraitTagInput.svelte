<script lang="ts">
    import { Badge, Input, Popover, PopoverTrigger, PopoverContent } from "$lib/components/ui";

    interface Props {
        value: string[];
        onchange: (traits: string[]) => void;
    }

    let { value, onchange }: Props = $props();

    let inputValue = $state("");
    let showSuggestions = $state(false);

    // Suggested traits
    const suggestions = [
        "amigavel",
        "profissional",
        "divertido",
        "casual",
        "inspirador",
        "educativo",
        "minimalista",
        "sofisticado",
        "criativo",
        "autêntico",
        "confiável",
        "moderno",
        "tradicional",
        "ousado",
        "elegante"
    ];

    // Filter suggestions based on input and already selected
    let filteredSuggestions = $derived(
        suggestions.filter(s =>
            !value.includes(s) &&
            (inputValue === "" || s.toLowerCase().includes(inputValue.toLowerCase()))
        )
    );

    function addTrait(trait: string) {
        const normalizedTrait = trait.trim().toLowerCase();
        if (normalizedTrait && !value.includes(normalizedTrait)) {
            onchange([...value, normalizedTrait]);
        }
        inputValue = "";
        showSuggestions = false;
    }

    function removeTrait(trait: string) {
        onchange(value.filter(t => t !== trait));
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Enter" && inputValue.trim()) {
            event.preventDefault();
            addTrait(inputValue);
        }
        if (event.key === "Backspace" && !inputValue && value.length > 0) {
            const lastTrait = value[value.length - 1];
            if (lastTrait) {
                removeTrait(lastTrait);
            }
        }
    }

    function handleInputFocus() {
        showSuggestions = true;
    }

    function handleInputBlur() {
        // Delay to allow click on suggestion
        setTimeout(() => {
            showSuggestions = false;
        }, 150);
    }
</script>

<div class="space-y-2">
    <!-- Tags display -->
    {#if value.length > 0}
        <div class="flex flex-wrap gap-2">
            {#each value as trait}
                <Badge variant="secondary" class="gap-1 pl-2.5 pr-1.5 py-1">
                    {trait}
                    <button
                        type="button"
                        aria-label="Remover {trait}"
                        class="ml-1 hover:text-destructive"
                        onclick={() => removeTrait(trait)}
                    >
                        <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </Badge>
            {/each}
        </div>
    {/if}

    <!-- Input with suggestions -->
    <div class="relative">
        <Input
            bind:value={inputValue}
            placeholder="Digite e pressione Enter para adicionar..."
            class="bg-background"
            onkeydown={handleKeydown}
            onfocus={handleInputFocus}
            onblur={handleInputBlur}
        />

        <!-- Suggestions dropdown -->
        {#if showSuggestions && filteredSuggestions.length > 0}
            <div class="absolute z-10 mt-1 w-full border border-border bg-popover shadow-md">
                <div class="max-h-48 overflow-y-auto p-1">
                    {#each filteredSuggestions.slice(0, 8) as suggestion}
                        <button
                            type="button"
                            class="flex w-full items-center px-2 py-1.5 text-sm text-left hover:bg-muted transition-colors"
                            onclick={() => addTrait(suggestion)}
                        >
                            {suggestion}
                        </button>
                    {/each}
                </div>
            </div>
        {/if}
    </div>

    <p class="text-xs text-muted-foreground">
        Adicione caracteristicas que definem o tom da sua marca
    </p>
</div>
