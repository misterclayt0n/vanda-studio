<script lang="ts">
	import type { Id } from "../../../convex/_generated/dataModel.js";

	interface CarouselItem {
		_id: Id<"media_items">;
		url: string | null;
		thumbnailUrl?: string | null;
		width: number;
		height: number;
		mimeType?: string;
	}

	interface Props {
		items: CarouselItem[];
		max?: number;
		onreorder: (fromIndex: number, toIndex: number) => void;
		onremove: (id: Id<"media_items">) => void;
	}

	let { items, max = 10, onreorder, onremove }: Props = $props();

	function isVideo(item: CarouselItem): boolean {
		return (item.mimeType ?? "").startsWith("video/");
	}
</script>

{#if items.length > 0}
	<div class="space-y-2">
		<div class="flex items-center justify-between">
			<p class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
				<svg
					class="h-3.5 w-3.5"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"
					/>
				</svg>
				Ordem do carrossel
			</p>
			<span class="text-xs text-muted-foreground">{items.length}/{max}</span>
		</div>

		<div class="flex gap-2 overflow-x-auto pb-1">
			{#each items as item, index (item._id)}
				<div class="group relative shrink-0">
					<!-- Thumbnail -->
					<div class="relative h-16 w-16 overflow-hidden border border-border bg-muted">
						{#if item.url}
							{#if isVideo(item)}
								<div class="flex h-full w-full items-center justify-center bg-neutral-800">
									<svg class="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
										<path d="M8 5v14l11-7z" />
									</svg>
								</div>
							{:else}
								<img
									src={item.thumbnailUrl ?? item.url}
									alt=""
									class="h-full w-full object-cover"
									loading="lazy"
									decoding="async"
								/>
							{/if}
						{:else}
							<div class="flex h-full w-full items-center justify-center">
								<svg class="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" />
								</svg>
							</div>
						{/if}

						<!-- Position badge -->
						<div class="absolute left-1 top-1 flex h-4 w-4 items-center justify-center bg-black/70 text-[9px] font-bold text-white">
							{index + 1}
						</div>

						<!-- Remove button -->
						<button
							type="button"
							class="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
							onclick={() => onremove(item._id)}
							aria-label="Remover"
						>
							<svg class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<!-- Reorder buttons -->
					<div class="mt-1 flex gap-0.5">
						<button
							type="button"
							class="flex h-5 flex-1 items-center justify-center border border-border bg-background text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
							onclick={() => onreorder(index, index - 1)}
							disabled={index === 0}
							aria-label="Mover para esquerda"
						>
							<svg class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
							</svg>
						</button>
						<button
							type="button"
							class="flex h-5 flex-1 items-center justify-center border border-border bg-background text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
							onclick={() => onreorder(index, index + 1)}
							disabled={index === items.length - 1}
							aria-label="Mover para direita"
						>
							<svg class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
							</svg>
						</button>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
