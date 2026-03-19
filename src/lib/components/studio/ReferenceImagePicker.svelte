<script lang="ts">
	import { useConvexClient } from "convex-svelte";
	import { api } from "../../../convex/_generated/api.js";
	import type { Id } from "../../../convex/_generated/dataModel.js";

	interface Reference {
		storageId: Id<"_storage">;
		previewUrl: string;
	}

	interface Props {
		references: Reference[];
		onchange: (refs: Reference[]) => void;
	}

	let { references, onchange }: Props = $props();

	const client = useConvexClient();
	const MAX = 5;

	let fileInputEl: HTMLInputElement;
	let dragOver = $state(false);

	// Optimistic pending items: show preview immediately while upload is in progress
	let pending = $state<{ tempId: string; previewUrl: string }[]>([]);

	let totalCount = $derived(references.length + pending.length);
	let canAdd = $derived(totalCount < MAX);

	async function uploadFile(file: File, tempId: string): Promise<Reference> {
		const uploadUrl = await client.mutation(api.referenceImages.generateUploadUrl, {});
		const response = await fetch(uploadUrl, {
			method: "POST",
			headers: { "Content-Type": file.type },
			body: file,
		});
		if (!response.ok) throw new Error("Falha ao fazer upload");
		const { storageId } = await response.json();
		// Resolve the object URL that was already shown during upload
		const previewUrl = pending.find((p) => p.tempId === tempId)?.previewUrl ?? URL.createObjectURL(file);
		return { storageId: storageId as Id<"_storage">, previewUrl };
	}

	async function handleFiles(files: File[]) {
		const imageFiles = files.filter((f) => f.type.startsWith("image/"));
		if (imageFiles.length === 0) return;

		const slots = MAX - totalCount;
		const toUpload = imageFiles.slice(0, slots);
		if (toUpload.length === 0) return;

		// Create previews immediately (optimistic)
		const newPending: Array<{ tempId: string; previewUrl: string }> = toUpload.map((file) => ({
			tempId: crypto.randomUUID(),
			previewUrl: URL.createObjectURL(file),
		}));
		pending = [...pending, ...newPending];

		try {
			const newRefs = await Promise.all(
				toUpload.map((file, i) => {
					const pendingItem = newPending[i];
					if (!pendingItem) throw new Error("Pending reference preview missing");
					return uploadFile(file, pendingItem.tempId);
				}),
			);
			// Remove from pending, add to committed references
			const uploadedIds = new Set<string>(newPending.map((p) => p.tempId));
			pending = pending.filter((p) => !uploadedIds.has(p.tempId));
			onchange([...references, ...newRefs]);
		} catch (err) {
			console.error("Upload failed:", err);
			// Remove failed pending items
			const uploadedIds = new Set<string>(newPending.map((p) => p.tempId));
			newPending.filter((p) => uploadedIds.has(p.tempId)).forEach((p) => URL.revokeObjectURL(p.previewUrl));
			pending = pending.filter((p) => !uploadedIds.has(p.tempId));
		}
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files) return;
		handleFiles(Array.from(input.files));
		input.value = "";
	}

	function handleRemove(index: number) {
		const ref = references[index];
		if (!ref) return;
		URL.revokeObjectURL(ref.previewUrl);
		onchange(references.filter((_, i) => i !== index));
	}

	function handleClear() {
		references.forEach((r) => URL.revokeObjectURL(r.previewUrl));
		pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
		pending = [];
		onchange([]);
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		const files = event.dataTransfer?.files;
		if (files) handleFiles(Array.from(files));
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}

	function handleDragLeave() {
		dragOver = false;
	}

	function handlePaste(event: ClipboardEvent) {
		const items = event.clipboardData?.items;
		if (!items) return;

		const imageFiles: File[] = [];
		for (const item of items) {
			if (item.type.startsWith("image/")) {
				const file = item.getAsFile();
				if (file) imageFiles.push(file);
			}
		}

		if (imageFiles.length > 0) {
			event.preventDefault();
			handleFiles(imageFiles);
		}
	}
</script>

<svelte:window onpaste={handlePaste} />

<div
	class="space-y-2"
	ondrop={handleDrop}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	role="region"
	aria-label="Imagens de referência"
>
	<!-- Header -->
	<div class="flex items-center justify-between">
		<p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
			<svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
			</svg>
			Referências
		</p>
		{#if totalCount > 0}
			<button
				type="button"
				class="text-xs text-muted-foreground hover:text-foreground transition-colors"
				onclick={handleClear}
			>
				Limpar
			</button>
		{/if}
	</div>

	<!-- Thumbnail row -->
	<div
		class="flex gap-2 overflow-x-auto pb-1 {dragOver ? 'rounded border border-dashed border-primary bg-primary/5 p-1' : ''}"
	>
		<!-- Committed thumbnails -->
		{#each references as ref, i (ref.storageId)}
			<div class="group relative shrink-0">
				<div class="h-16 w-16 overflow-hidden rounded border border-border bg-muted">
					<img
						src={ref.previewUrl}
						alt="Referência {i + 1}"
						class="h-full w-full object-cover"
					/>
				</div>
				<!-- Number badge -->
				<span class="pointer-events-none absolute bottom-0.5 left-0.5 flex h-4 w-4 items-center justify-center rounded bg-black/60 text-[10px] font-medium text-white leading-none">
					{i + 1}
				</span>
				<!-- Remove button -->
				<button
					type="button"
					aria-label="Remover imagem {i + 1}"
					class="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white opacity-0 shadow-sm transition-opacity hover:bg-black/85 focus-visible:opacity-100 group-hover:opacity-100"
					onclick={() => handleRemove(i)}
				>
					<svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.4" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		{/each}

		<!-- Pending (uploading) thumbnails -->
		{#each pending as item (item.tempId)}
			<div class="relative shrink-0">
				<div class="h-16 w-16 overflow-hidden rounded border border-border bg-muted">
					<img
						src={item.previewUrl}
						alt="Enviando..."
						class="h-full w-full object-cover opacity-60"
					/>
				</div>
				<!-- Spinner overlay -->
				<div class="pointer-events-none absolute inset-0 flex items-center justify-center rounded bg-black/30">
					<svg class="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
				</div>
			</div>
		{/each}

		<!-- Add button -->
		{#if canAdd}
			<button
				type="button"
				class="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-dashed border-border bg-muted/50 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
				onclick={() => fileInputEl.click()}
				aria-label="Adicionar imagem de referência"
			>
				<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
			</button>
		{/if}
	</div>

	<input
		bind:this={fileInputEl}
		type="file"
		accept="image/*"
		multiple
		class="hidden"
		onchange={handleFileSelect}
	/>

	<!-- Hint -->
	<p class="text-xs text-muted-foreground">
		Cole (Ctrl+V), arraste ou clique + ({totalCount}/{MAX})
	</p>
</div>
