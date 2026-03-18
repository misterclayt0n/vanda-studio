<script lang="ts">
	import { goto } from "$app/navigation";
	import { Badge } from "$lib/components/ui";
	import type { Id } from "../../../convex/_generated/dataModel.js";

	interface ConversationOutput {
		_id: Id<"image_edit_outputs">;
		url: string | null;
		thumbnailUrl?: string | null;
		model: string;
	}

	interface ConversationTurn {
		userMessage: string;
		pendingModels?: string[];
		outputs: ConversationOutput[];
	}

	interface Conversation {
		_id: Id<"image_edit_conversations">;
		title: string;
		turnCount: number;
		thumbnailUrl: string | null | undefined;
		createdAt: number;
		updatedAt?: number;
		latestTurn?: ConversationTurn | null;
	}

	interface Props {
		conversation: Conversation;
	}

	let { conversation }: Props = $props();

	const modelDisplayNames: Record<string, string> = {
		"google/gemini-2.5-flash-image": "Nano Banana",
		"google/gemini-3.1-flash-image-preview": "Nano Banana 2",
		"google/gemini-3-pro-image-preview": "Nano Banana Pro",
		"bytedance-seed/seedream-4.5": "SeeDream v4.5",
		"black-forest-labs/flux.2-flex": "Flux 2 Flex",
		"openai/gpt-5-image": "GPT Image 1.5",
	};

	let headline = $derived(conversation.latestTurn?.userMessage?.trim() || conversation.title);
	let previewOutputs = $derived((conversation.latestTurn?.outputs ?? []).slice(0, 3));
	let pendingCount = $derived(conversation.latestTurn?.pendingModels?.length ?? 0);

	function formatRelativeTime(timestamp: number): string {
		const diff = Date.now() - timestamp;
		if (diff < 60_000) return "agora";
		if (diff < 60 * 60_000) return `${Math.max(1, Math.floor(diff / 60_000))} min`;
		if (diff < 24 * 60 * 60_000) return `${Math.max(1, Math.floor(diff / 3_600_000))} h`;
		return new Date(timestamp).toLocaleDateString("pt-BR", {
			day: "2-digit",
			month: "short",
		});
	}

	function getModelDisplayName(model?: string): string {
		if (!model) return "Output";
		return modelDisplayNames[model] ?? model.split("/").pop() ?? model;
	}

	function handleClick() {
		goto(`/images/conversations/${conversation._id}`);
	}
</script>

<button
	type="button"
	class="group w-full rounded-2xl border border-border bg-card/70 p-3 text-left transition-colors hover:border-primary/30 hover:bg-muted/50"
	onclick={handleClick}
>
	<div class="flex items-start gap-3">
		<div class="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
			{#if conversation.thumbnailUrl}
				<img src={conversation.thumbnailUrl} alt="" class="h-full w-full object-cover" />
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

		<div class="min-w-0 flex-1">
			<div class="flex items-start justify-between gap-3">
				<div class="min-w-0">
					<p class="truncate text-sm font-semibold text-foreground">{headline}</p>
					<div class="mt-1 flex flex-wrap items-center gap-2">
						<Badge variant="secondary" class="text-[10px]">
							{conversation.turnCount} turno{conversation.turnCount !== 1 ? "s" : ""}
						</Badge>
						<span class="text-xs text-muted-foreground">
							{formatRelativeTime(conversation.updatedAt ?? conversation.createdAt)}
						</span>
						{#if pendingCount > 0}
							<span class="text-xs text-muted-foreground">{pendingCount} gerando</span>
						{/if}
					</div>
				</div>

				<svg
					class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
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
			</div>

			{#if previewOutputs.length > 0}
				<div class="mt-3 grid grid-cols-3 gap-2">
					{#each previewOutputs as output (output._id)}
						<div class="overflow-hidden rounded-xl border border-border bg-background">
							<div class="aspect-square overflow-hidden bg-muted">
								{#if output.url}
									<img
										src={output.thumbnailUrl ?? output.url}
										alt={getModelDisplayName(output.model)}
										loading="lazy"
										decoding="async"
										class="h-full w-full object-cover"
									/>
								{/if}
							</div>
							<div class="px-2 py-1.5">
								<p class="truncate text-[11px] font-medium text-foreground">
									{getModelDisplayName(output.model)}
								</p>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</button>
