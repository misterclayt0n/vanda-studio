<script lang="ts">
	import { cn } from "$lib/utils";
	import { IMAGE_PRESETS } from "$lib/data/imagePresets";
	import { POST_TEMPLATES } from "$lib/data/postTemplates";
	import { Layers, ChevronRight, X } from "lucide-svelte";

	let {
		selectedPreset = $bindable<string>("photorealistic"),
		selectedTemplateId = $bindable<string | null>(null),
	}: {
		selectedPreset?: string;
		selectedTemplateId?: string | null;
	} = $props();

	let pickerOpen = $state(false);

	let activeTemplate = $derived(
		selectedTemplateId ? POST_TEMPLATES.find((t) => t.id === selectedTemplateId) : undefined
	);

	let molduraMode = $derived(selectedTemplateId !== null);

	function closePicker() {
		pickerOpen = false;
	}

	function chooseNone() {
		selectedTemplateId = null;
		closePicker();
	}

	function chooseTemplate(id: string) {
		selectedTemplateId = id;
		closePicker();
	}

	function selectPreset(presetKey: string) {
		selectedPreset = presetKey;
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === "Escape") closePicker();
	}}
/>

<div class="space-y-3">
	<p
		class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
	>
		<Layers class="h-3.5 w-3.5" stroke-width={1.5} />
		Estilo
	</p>

	<div class="grid grid-cols-2 gap-1.5">
		{#each IMAGE_PRESETS as preset}
			<button
				type="button"
				disabled={molduraMode}
				class={cn(
					"rounded-lg border px-2.5 py-2 text-left transition-all duration-200",
					molduraMode && "cursor-not-allowed opacity-35",
					!molduraMode && selectedPreset === preset.key
						? "border-primary/45 bg-primary/[0.07] text-foreground ring-1 ring-primary/15"
						: !molduraMode
							? "border-border/90 bg-transparent text-muted-foreground hover:border-border hover:bg-muted/20 hover:text-foreground"
							: "border-border/90 bg-transparent text-muted-foreground"
				)}
				onclick={() => selectPreset(preset.key)}
			>
				<span class="block text-xs font-medium">{preset.label}</span>
				<span class="mt-0.5 block text-[10px] leading-snug text-muted-foreground/75">{preset.sublabel}</span>
			</button>
		{/each}

		<!-- Moldura = estilo próprio; mutually exclusive with presets above -->
		<button
			type="button"
			class={cn(
				"col-span-2 flex items-center gap-2.5 rounded-lg border px-2.5 py-2.5 text-left transition-all duration-200",
				molduraMode
					? "border-primary/45 bg-primary/[0.07] text-foreground ring-1 ring-primary/15"
					: "border-border/90 bg-transparent text-muted-foreground hover:border-border hover:bg-muted/20 hover:text-foreground"
			)}
			onclick={() => (pickerOpen = true)}
		>
			{#if activeTemplate}
				<div class="relative h-12 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
					<img src={activeTemplate.previewPath} alt="" class="h-full w-full object-cover" />
				</div>
				<div class="min-w-0 flex-1">
					<span class="block truncate text-xs font-semibold text-foreground">{activeTemplate.title}</span>
					<span class="block truncate text-[10px] text-muted-foreground">Moldura</span>
				</div>
			{:else}
				<div class="flex h-12 w-10 shrink-0 items-center justify-center rounded-md bg-muted/50">
					<Layers class="h-4 w-4 text-muted-foreground" stroke-width={1.5} />
				</div>
				<div class="min-w-0 flex-1">
					<span class="block text-xs font-medium text-foreground">Moldura</span>
					<span class="block text-[10px] text-muted-foreground">Catálogo…</span>
				</div>
			{/if}
			<ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" stroke-width={2} />
		</button>
	</div>
</div>

{#if pickerOpen}
	<div
		class="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="molduras-title"
	>
		<button
			type="button"
			class="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
			aria-label="Fechar"
			onclick={closePicker}
		></button>
		<div
			class="relative z-[1] flex max-h-[min(88vh,640px)] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-background shadow-2xl sm:rounded-2xl"
		>
			<div class="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
				<h2 id="molduras-title" class="text-sm font-semibold tracking-tight">Molduras</h2>
				<button
					type="button"
					class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
					aria-label="Fechar"
					onclick={closePicker}
				>
					<X class="h-4 w-4" stroke-width={2} />
				</button>
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto p-4">
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
					<button
						type="button"
						class={cn(
							"flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all",
							!molduraMode
								? "border-primary/50 ring-2 ring-primary/20"
								: "border-border hover:border-muted-foreground/40"
						)}
						onclick={chooseNone}
					>
						<div class="flex aspect-[4/5] w-full items-center justify-center bg-muted/30 px-2">
							<span class="text-center text-sm font-medium">Sem moldura</span>
						</div>
					</button>

					{#each POST_TEMPLATES as template (template.id)}
						<button
							type="button"
							class={cn(
								"group flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all",
								selectedTemplateId === template.id
									? "border-primary/50 ring-2 ring-primary/20"
									: "border-border hover:border-muted-foreground/40"
							)}
							onclick={() => chooseTemplate(template.id)}
						>
							<div class="relative aspect-[4/5] w-full bg-muted">
								<img
									src={template.previewPath}
									alt=""
									class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
									loading="lazy"
								/>
								<div
									class="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/95 via-transparent to-transparent"
								></div>
								<div class="absolute inset-x-0 bottom-0 p-2.5">
									<span class="block text-sm font-semibold leading-tight">{template.title}</span>
								</div>
							</div>
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>
{/if}
