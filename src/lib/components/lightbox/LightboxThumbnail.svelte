<script lang="ts">
    interface Props {
        url: string | null;
        selected?: boolean;
        label?: string | undefined;
        onclick?: () => void;
    }

    let { url, selected = false, label = undefined, onclick }: Props = $props();
</script>

<button
    type="button"
    class="group relative aspect-square overflow-hidden border-2 transition-all {selected
        ? 'border-primary ring-2 ring-primary/20'
        : 'border-border hover:border-muted-foreground'}"
    {onclick}
>
    {#if url}
        <img src={url} alt="" class="h-full w-full object-cover" />
    {:else}
        <div class="flex h-full w-full items-center justify-center bg-muted">
            <svg
                class="h-4 w-4 text-muted-foreground"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                />
            </svg>
        </div>
    {/if}
    {#if label}
        <div
            class="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-center text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
        >
            {label}
        </div>
    {/if}
</button>
