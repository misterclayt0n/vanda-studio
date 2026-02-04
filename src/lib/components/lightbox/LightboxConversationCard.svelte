<script lang="ts">
    import { goto } from "$app/navigation";
    import { Badge } from "$lib/components/ui";
    import type { Id } from "../../../convex/_generated/dataModel.js";

    interface Conversation {
        _id: Id<"image_edit_conversations">;
        title: string;
        turnCount: number;
        thumbnailUrl: string | null | undefined;
        createdAt: number;
    }

    interface Props {
        conversation: Conversation;
    }

    let { conversation }: Props = $props();

    function formatDate(timestamp: number): string {
        const date = new Date(timestamp);
        return date.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
        });
    }

    function handleClick() {
        goto(`/posts/edit/${conversation._id}`);
    }
</script>

<button
    type="button"
    class="group flex w-full items-center gap-3 border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50"
    onclick={handleClick}
>
    <!-- Thumbnail -->
    <div class="h-12 w-12 shrink-0 overflow-hidden border border-border bg-muted">
        {#if conversation.thumbnailUrl}
            <img
                src={conversation.thumbnailUrl}
                alt=""
                class="h-full w-full object-cover"
            />
        {:else}
            <div class="flex h-full w-full items-center justify-center">
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
                        d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                    />
                </svg>
            </div>
        {/if}
    </div>

    <!-- Info -->
    <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">{conversation.title}</p>
        <div class="mt-1 flex items-center gap-2">
            <Badge variant="secondary" class="text-[10px]">
                {conversation.turnCount} turn{conversation.turnCount !== 1 ? "s" : ""}
            </Badge>
            <span class="text-xs text-muted-foreground">
                {formatDate(conversation.createdAt)}
            </span>
        </div>
    </div>

    <!-- Arrow -->
    <svg
        class="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
    >
        <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M8.25 4.5l7.5 7.5-7.5 7.5"
        />
    </svg>
</button>
