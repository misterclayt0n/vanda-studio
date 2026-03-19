<script lang="ts">
	interface MediaItem {
		_id: string;
		url: string | null;
		thumbnailUrl?: string | null;
		width: number;
		height: number;
		mimeType?: string;
	}

	interface Props {
		mediaItems: MediaItem[];
		caption: string;
		accountName?: string;
		profilePictureUrl?: string | undefined;
		currentIndex?: number;
		onindexchange?: (index: number) => void;
	}

	let {
		mediaItems,
		caption,
		accountName = "sua_conta",
		profilePictureUrl,
		currentIndex = $bindable(0),
		onindexchange,
	}: Props = $props();

	let activeIndex = $state(currentIndex);

	$effect(() => {
		activeIndex = currentIndex;
	});

	function goTo(index: number) {
		activeIndex = index;
		onindexchange?.(index);
	}

	function prev() {
		if (activeIndex > 0) goTo(activeIndex - 1);
	}

	function next() {
		if (activeIndex < mediaItems.length - 1) goTo(activeIndex + 1);
	}

	let activeItem = $derived(mediaItems[activeIndex] ?? null);

	// Clamp to Instagram's 4:5 max (vertical) and 1.91:1 max (horizontal)
	function getPreviewAspectRatio(width: number, height: number): string {
		if (width <= 0 || height <= 0) return "1 / 1";
		const ratio = height / width;
		// Instagram max vertical: 4:5 (ratio = 1.25)
		// Instagram max horizontal: 1.91:1 (ratio ≈ 0.52)
		const clamped = Math.min(Math.max(ratio, 0.52), 1.25);
		return `${width} / ${Math.round(width * clamped)}`;
	}

	let previewAspect = $derived(
		activeItem
			? getPreviewAspectRatio(activeItem.width, activeItem.height)
			: "1 / 1"
	);

	function isVideo(item: MediaItem): boolean {
		return (item.mimeType ?? "").startsWith("video/");
	}

	function escapeHtml(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}

	function renderCaption(text: string): string {
		const escaped = escapeHtml(text);
		const withBreaks = escaped.replace(/\n/g, "<br>");
		return withBreaks.replace(
			/(#[\p{L}\p{N}_]+)/gu,
			'<span class="text-blue-400">$1</span>'
		);
	}
</script>

<!-- Phone chrome -->
<div class="mx-auto w-full max-w-[320px] select-none">
	<!-- Phone outer frame -->
	<div class="relative rounded-[2.5rem] border-4 border-neutral-800 bg-neutral-900 shadow-[0_0_40px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)]">
		<!-- Top notch -->
		<div class="flex items-center justify-center pt-3 pb-1">
			<div class="h-1.5 w-16 rounded-full bg-neutral-700"></div>
		</div>

		<!-- Screen area -->
		<div class="overflow-hidden rounded-[1.75rem] bg-black">
			<!-- Instagram status bar -->
			<div class="flex items-center justify-between bg-black px-4 py-1.5">
				<span class="text-[10px] font-semibold text-white">9:41</span>
				<div class="flex items-center gap-1">
					<svg class="h-3 w-3 fill-white" viewBox="0 0 24 24"><path d="M1.5 8.5C5.5 4.5 10.5 2.5 12 2.5s6.5 2 10.5 6M4.5 11.5c2.3-2.3 4.7-3.5 7.5-3.5s5.2 1.2 7.5 3.5M7.5 14.5c1.3-1.3 2.8-2 4.5-2s3.2.7 4.5 2M10.5 17.5c.8-.8 1.5-1 1.5-1s.7.2 1.5 1"/><circle cx="12" cy="20.5" r="1.5" fill="white"/></svg>
					<svg class="h-3 w-3 fill-white" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="10" rx="2"/><rect x="22" y="10" width="2" height="4" rx="1"/></svg>
				</div>
			</div>

			<!-- Instagram header -->
			<div class="flex items-center justify-between border-b border-neutral-800 bg-black px-3 py-2">
				<div class="flex items-center gap-2">
					{#if profilePictureUrl}
						<img src={profilePictureUrl} alt="" class="h-7 w-7 rounded-full object-cover ring-1 ring-fuchsia-500/50" />
					{:else}
						<div class="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-orange-400 to-yellow-400 text-[10px] font-bold text-white">
							{accountName[0]?.toUpperCase() ?? "?"}
						</div>
					{/if}
					<span class="text-xs font-semibold text-white">{accountName}</span>
				</div>
				<svg class="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm6 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm6 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0z" />
				</svg>
			</div>

			<!-- Media area -->
			<div class="relative bg-neutral-900">
				{#if activeItem?.url}
					{#if isVideo(activeItem)}
						<!-- svelte-ignore a11y_media_has_caption -->
						<video
							src={activeItem.url}
							class="w-full object-cover"
							style="aspect-ratio: {previewAspect};"
							autoplay
							muted
							loop
							playsinline
						></video>
					{:else}
						<img
							src={activeItem.thumbnailUrl ?? activeItem.url}
							alt=""
							class="w-full object-cover"
							style="aspect-ratio: {previewAspect};"
							loading="lazy"
							decoding="async"
						/>
					{/if}

					<!-- Carousel arrows -->
					{#if mediaItems.length > 1}
						{#if activeIndex > 0}
							<button
								type="button"
								class="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-opacity hover:bg-black/70"
								onclick={prev}
								aria-label="Anterior"
							>
								<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
								</svg>
							</button>
						{/if}
						{#if activeIndex < mediaItems.length - 1}
							<button
								type="button"
								class="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-opacity hover:bg-black/70"
								onclick={next}
								aria-label="Próximo"
							>
								<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
								</svg>
							</button>
						{/if}

						<!-- Dot indicators -->
						<div class="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
							{#each mediaItems as _, i}
								<button
									type="button"
									class="h-1.5 rounded-full transition-all {i === activeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}"
									onclick={() => goTo(i)}
									aria-label="Ir para {i + 1}"
								></button>
							{/each}
						</div>
					{/if}
				{:else}
					<!-- Empty placeholder -->
					<div class="flex aspect-square items-center justify-center bg-neutral-800">
						<svg class="h-12 w-12 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
						</svg>
					</div>
				{/if}
			</div>

			<!-- Action bar -->
			<div class="flex items-center justify-between bg-black px-3 py-2">
				<div class="flex items-center gap-3">
					<svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
					</svg>
					<svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
					</svg>
					<svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
					</svg>
				</div>
				<svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
				</svg>
			</div>

			<!-- Caption area -->
			{#if caption}
				<div class="bg-black px-3 pb-4">
					<p class="text-xs leading-relaxed text-white">
						<span class="mr-1 font-semibold">{accountName}</span><!-- eslint-disable-next-line svelte/no-at-html-tags -->{@html renderCaption(caption)}
					</p>
				</div>
			{/if}

			<!-- Bottom safe area -->
			<div class="h-4 bg-black"></div>
		</div>

		<!-- Bottom home indicator -->
		<div class="flex items-center justify-center py-2">
			<div class="h-1 w-24 rounded-full bg-neutral-700"></div>
		</div>
	</div>
</div>
