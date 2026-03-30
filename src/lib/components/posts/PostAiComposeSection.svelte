<script lang="ts">
	import { cn } from "$lib/utils";
	import { Button, Textarea } from "$lib/components/ui";
	import { ImageModelSelector, ResolutionSelector } from "$lib/components/studio";
	import {
		POST_TEMPLATES_FOR_COMPOSER,
		getPostTemplateReferenceFiles,
	} from "$lib/data/postTemplates";
	import { Layers, ChevronRight, Sparkles, X } from "lucide-svelte";
	import { useConvexClient } from "convex-svelte";
	import { api } from "../../../convex/_generated/api.js";
	import type { Id } from "../../../convex/_generated/dataModel.js";
	import {
		coerceImageGenerationSettings,
		getSupportedResolutions,
		type AspectRatio,
		type Resolution,
	} from "$lib/studio/imageGenerationCapabilities";
	import { STALE_COMPOSE_MS } from "$lib/studio/postComposerState";

	const DEFAULT_IMAGE_MODEL = "bytedance-seed/seedream-4.5";
	const PREFERRED_POST_ASPECT: AspectRatio = "3:4";

	type ProjectContextPayload = {
		accountDescription?: string;
		brandTraits?: string[];
		additionalContext?: string;
		contextImageUrls?: string[];
		brandContextMarkdown?: string;
	};

	interface Props {
		captionBrief?: string;
		aiTemplateId?: string | null;
		aiImageModel?: string;
		aiResolution?: Resolution;
		captionModel: string;
		selectedProjectId: Id<"projects"> | null;
		includeProjectContext: boolean;
		aiComposePending: boolean;
		/** Wall-clock start for stale detection; null if unknown */
		aiComposeStartedAt: number | null;
		getProjectContext: () => ProjectContextPayload | undefined;
		billingMonthlyIncluded: number | null;
		onComposePersistStart: () => void;
		onComposePersistSuccess: (
			mediaItemIds: Id<"media_items">[],
			generatedCaption: string
		) => void;
		onComposePersistError: () => void;
		onComposeStaleClear: () => void;
		onPersistenceMark: () => void;
	}

	let {
		captionBrief = $bindable(""),
		aiTemplateId = $bindable<string | null>(null),
		aiImageModel = $bindable(DEFAULT_IMAGE_MODEL),
		aiResolution = $bindable<Resolution>("standard"),
		captionModel,
		selectedProjectId,
		includeProjectContext,
		aiComposePending,
		aiComposeStartedAt,
		getProjectContext,
		billingMonthlyIncluded,
		onComposePersistStart,
		onComposePersistSuccess,
		onComposePersistError,
		onComposeStaleClear,
		onPersistenceMark,
	}: Props = $props();

	const sectionLabelClass =
		"flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground";

	const client = useConvexClient();

	let pickerOpen = $state(false);
	let localError = $state<string | null>(null);

	let composeImageModel = $derived([aiImageModel]);

	let activeTemplate = $derived(
		aiTemplateId ? POST_TEMPLATES_FOR_COMPOSER.find((t) => t.id === aiTemplateId) : undefined
	);
	let activeTemplateSlideCount = $derived(
		activeTemplate ? getPostTemplateReferenceFiles(activeTemplate).length : 0
	);

	let supportedResolutions = $derived(getSupportedResolutions(composeImageModel));

	let aspectRatio = $derived(
		coerceImageGenerationSettings(composeImageModel, PREFERRED_POST_ASPECT, aiResolution)
			.aspectRatio
	);

	$effect(() => {
		const normalized = coerceImageGenerationSettings(
			composeImageModel,
			PREFERRED_POST_ASPECT,
			aiResolution
		);
		if (normalized.resolution !== aiResolution) {
			aiResolution = normalized.resolution;
		}
	});

	$effect(() => {
		if (!aiComposePending || aiComposeStartedAt === null) return;
		if (Date.now() - aiComposeStartedAt > STALE_COMPOSE_MS) {
			onComposeStaleClear();
		}
	});

	function closePicker() {
		pickerOpen = false;
	}

	function chooseNone() {
		aiTemplateId = null;
		onPersistenceMark();
		closePicker();
	}

	function chooseTemplate(id: string) {
		aiTemplateId = id;
		onPersistenceMark();
		closePicker();
	}

	async function handleComposeAll() {
		const brief = captionBrief.trim();
		if (!brief) {
			localError = "Escreva um brief para gerar mídia e legenda.";
			return;
		}
		localError = null;
		onComposePersistStart();
		try {
			const projectContext =
				includeProjectContext && selectedProjectId ? getProjectContext() : undefined;
			const imageModel = aiImageModel;
			const result = await client.action(api.ai.composePostFromBrief.composeFromBrief, {
				brief,
				captionModel,
				imageModel,
				aspectRatio,
				resolution: aiResolution,
				...(selectedProjectId && { projectId: selectedProjectId }),
				...(aiTemplateId && { templateId: aiTemplateId }),
				...(projectContext && { projectContext }),
			});
			onComposePersistSuccess(result.mediaItemIds, result.caption);
		} catch (e) {
			onComposePersistError();
			localError = e instanceof Error ? e.message : "Erro ao gerar post com IA";
		}
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === "Escape") closePicker();
	}}
/>

<div class="relative space-y-3 rounded-xl border border-border bg-background/40 p-3">
	<p class={sectionLabelClass}>
		<Sparkles class="h-3.5 w-3.5" stroke-width={1.5} />
		Criar com IA
	</p>

	<Textarea
		bind:value={captionBrief}
		oninput={onPersistenceMark}
		placeholder="Brief do post: tema, mensagens, tom, CTA…"
		class="min-h-[88px] resize-none bg-background text-sm"
		disabled={aiComposePending}
	/>

	<div class="space-y-2">
		<p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Template</p>
		<button
			type="button"
			disabled={aiComposePending}
			class={cn(
				"flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all",
				aiTemplateId
					? "border-primary/45 bg-primary/[0.07] text-foreground ring-1 ring-primary/15"
					: "border-border/90 bg-transparent text-muted-foreground hover:border-border hover:bg-muted/20 hover:text-foreground",
				aiComposePending && "pointer-events-none opacity-50"
			)}
			onclick={() => (pickerOpen = true)}
		>
			{#if activeTemplate}
				<div class="relative h-12 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
					<img src={activeTemplate.previewPath} alt="" class="h-full w-full object-cover" />
				</div>
				<div class="min-w-0 flex-1">
					<span class="block truncate text-xs font-semibold text-foreground">{activeTemplate.title}</span>
					<span class="block truncate text-[10px] text-muted-foreground">
						Moldura · {activeTemplateSlideCount}
						{activeTemplateSlideCount === 1 ? "imagem" : "slides"}
					</span>
				</div>
			{:else}
				<div class="flex h-12 w-10 shrink-0 items-center justify-center rounded-md bg-muted/50">
					<Layers class="h-4 w-4 text-muted-foreground" stroke-width={1.5} />
				</div>
				<div class="min-w-0 flex-1">
					<span class="block text-xs font-medium text-foreground">Sem template</span>
					<span class="block text-[10px] text-muted-foreground">Uma imagem única</span>
				</div>
			{/if}
			<ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" stroke-width={2} />
		</button>
	</div>

	<div class="space-y-2">
		<p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Modelo de imagem</p>
		<ImageModelSelector
			selected={composeImageModel}
			onchange={(models) => {
				const next = models[0] ?? DEFAULT_IMAGE_MODEL;
				aiImageModel = next;
				onPersistenceMark();
			}}
			maxModels={1}
			monthlyIncludedCredits={billingMonthlyIncluded}
			usageIndicatorMode="percent"
			compact
		/>
	</div>

	<div class="space-y-2">
		<p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Resolução</p>
		<ResolutionSelector
			value={aiResolution}
			onchange={(v) => {
				aiResolution = v;
				onPersistenceMark();
			}}
			supportedValues={supportedResolutions}
			compact
		/>
	</div>

	{#if localError}
		<p class="text-xs text-destructive">{localError}</p>
	{/if}

	<Button
		class="w-full gap-2"
		onclick={handleComposeAll}
		disabled={aiComposePending || !captionBrief.trim()}
	>
		<Sparkles class="h-4 w-4" stroke-width={1.5} />
		Gerar mídia e legenda
	</Button>
</div>

{#if pickerOpen}
	<div
		class="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="post-molduras-title"
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
				<h2 id="post-molduras-title" class="text-sm font-semibold tracking-tight">Molduras (post)</h2>
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
							!aiTemplateId
								? "border-primary/50 ring-2 ring-primary/20"
								: "border-border hover:border-muted-foreground/40"
						)}
						onclick={chooseNone}
					>
						<div class="flex aspect-[4/5] w-full items-center justify-center bg-muted/30 px-2">
							<span class="text-center text-sm font-medium">Sem moldura</span>
						</div>
					</button>

					{#each POST_TEMPLATES_FOR_COMPOSER as template (template.id)}
						<button
							type="button"
							class={cn(
								"group flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all",
								aiTemplateId === template.id
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
