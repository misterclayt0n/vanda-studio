<script lang="ts">
    import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "$lib/components/ui";
    
    interface Props {
        model?: string;
        aspectRatio?: string;
        size?: "full" | "thumbnail";
    }
    
    let { model, aspectRatio = "1:1", size = "full" }: Props = $props();
    
    // Model name mapping for display
    const modelDisplayNames: Record<string, string> = {
        "google/gemini-2.5-flash-image": "Nano Banana",
        "google/gemini-3-pro-image-preview": "Nano Banana Pro",
        "bytedance-seed/seedream-4.5": "SeeDream v4.5",
        "black-forest-labs/flux.2-flex": "Flux 2 Flex",
        "openai/gpt-5-image": "GPT Image 1.5",
    };
    
    let displayName = $derived(modelDisplayNames[model ?? ""] ?? model?.split("/").pop() ?? "");
    
    // Parse aspect ratio for styling
    let ratioNumbers = $derived(aspectRatio.split(":").map(Number));
    let w = $derived(ratioNumbers[0] ?? 1);
    let h = $derived(ratioNumbers[1] ?? 1);
</script>

<TooltipProvider>
    <Tooltip>
        <TooltipTrigger>
            {#if size === "thumbnail"}
                <div 
                    class="group relative h-20 w-20 overflow-hidden border-2 border-dashed border-border bg-muted animate-pulse"
                >
                    <div class="absolute inset-0 flex flex-col items-center justify-center gap-1">
                        <svg class="h-4 w-4 animate-spin text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                    <div class="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-center text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                        {displayName}
                    </div>
                </div>
            {:else}
                <div 
                    class="relative overflow-hidden border border-dashed border-border bg-muted animate-pulse"
                    style="aspect-ratio: {w} / {h};"
                >
                    <div class="absolute inset-0 flex flex-col items-center justify-center gap-3">
                        <svg class="h-8 w-8 animate-spin text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {#if model}
                            <span class="text-xs text-muted-foreground">{displayName}</span>
                        {/if}
                    </div>
                </div>
            {/if}
        </TooltipTrigger>
        <TooltipContent>
            <p>Não se preocupe, isso leva alguns segundos</p>
        </TooltipContent>
    </Tooltip>
</TooltipProvider>
