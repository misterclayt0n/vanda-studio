<script lang="ts">
	import { Button, Textarea, Badge } from "$lib/components/ui";
	import {
		ImageModelSelector,
		AspectRatioSelector,
		ResolutionSelector,
	} from "$lib/components/studio";
	import { SignedIn, SignedOut, SignInButton, UserButton } from "svelte-clerk";
	import { useConvexClient, useQuery } from "convex-svelte";
	import { api } from "../../../../convex/_generated/api.js";
	import type { Id } from "../../../../convex/_generated/dataModel.js";
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import Logo from "$lib/components/Logo.svelte";

	type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "21:9";
	type Resolution = "standard" | "high" | "ultra";

	const client = useConvexClient();

	const modelDisplayNames: Record<string, string> = {
		"google/gemini-2.5-flash-image": "Nano Banana",
		"google/gemini-3-pro-image-preview": "Nano Banana Pro",
		"bytedance-seed/seedream-4.5": "SeeDream v4.5",
		"black-forest-labs/flux.2-flex": "Flux 2 Flex",
		"openai/gpt-5-image": "GPT Image 1.5",
	};

	let sourceMediaId = $derived($page.url.searchParams.get("sourceMediaId") as Id<"media_items"> | null);
	const sourceMediaQuery = useQuery(
		api.mediaItems.get,
		() => sourceMediaId ? { id: sourceMediaId } : "skip"
	);

	let sourceMedia = $derived(sourceMediaQuery.data);

	let selectedModels = $state<string[]>(["google/gemini-3-pro-image-preview"]);
	let aspectRatio = $state<AspectRatio>("1:1");
	let resolution = $state<Resolution>("standard");
	let editPrompt = $state("");
	let isStarting = $state(false);
	let initializedFromSource = $state(false);

	$effect(() => {
		if (!sourceMedia || initializedFromSource) return;
		selectedModels = sourceMedia.model ? [sourceMedia.model] : ["google/gemini-3-pro-image-preview"];
		aspectRatio = (sourceMedia.aspectRatio as AspectRatio | undefined) ?? "1:1";
		resolution = (sourceMedia.resolution as Resolution | undefined) ?? "standard";
		initializedFromSource = true;
	});

	function getModelDisplayName(model?: string): string {
		if (!model) return "Imagem";
		return modelDisplayNames[model] ?? model.split("/").pop() ?? model;
	}

	function getMediaAspectRatio(): string {
		if (sourceMedia?.width && sourceMedia?.height) {
			return `${sourceMedia.width} / ${sourceMedia.height}`;
		}
		if (!sourceMedia?.aspectRatio) return "1 / 1";
		const [width, height] = sourceMedia.aspectRatio.split(":");
		if (!width || !height) return "1 / 1";
		return `${width} / ${height}`;
	}

	async function handleStartConversation() {
		if (!sourceMediaId || !editPrompt.trim() || selectedModels.length === 0 || isStarting) return;
		isStarting = true;
		try {
			const result = await client.mutation(api.imageEditConversations.startWithTurn, {
				sourceMediaId,
				userMessage: editPrompt.trim(),
				selectedModels,
				aspectRatio,
				resolution,
			});

			goto(`/images/conversations/${result.conversationId}?turnId=${result.turnId}`);
		} catch (err) {
			console.error("Failed to start conversation:", err);
			isStarting = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
			handleStartConversation();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>Nova conversa - Vanda Studio</title>
</svelte:head>

<div class="flex h-screen flex-col bg-background">
	<header class="shrink-0 border-b border-border">
		<div class="flex h-14 items-center justify-between px-4">
			<div class="flex items-center gap-4">
				<a href="/"><Logo /></a>
				<div class="h-6 w-px bg-border"></div>
				<button
					type="button"
					class="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
					onclick={() => goto("/images")}
				>
					<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
					</svg>
					Imagens
				</button>
				<div>
					<p class="text-sm font-medium">Nova conversa</p>
					<p class="text-xs text-muted-foreground">Comece a editar esta imagem</p>
				</div>
			</div>

			<SignedOut>
				<SignInButton mode="modal">
					<button class="h-8 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted">
						Entrar
					</button>
				</SignInButton>
			</SignedOut>
			<SignedIn>
				<UserButton />
			</SignedIn>
		</div>
	</header>

	<div class="flex min-h-0 flex-1">
		<aside class="flex w-80 shrink-0 flex-col border-r border-border bg-muted/20">
			<div class="space-y-5 overflow-y-auto p-4">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-semibold text-foreground">Configurações</h2>
					<Badge variant="secondary">{selectedModels.length} ativo{selectedModels.length > 1 ? "s" : ""}</Badge>
				</div>

				<div class="space-y-2">
					<p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Modelos</p>
					<ImageModelSelector selected={selectedModels} onchange={(models) => (selectedModels = models)} compact />
				</div>

				<div class="space-y-2">
					<p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Proporção</p>
					<AspectRatioSelector value={aspectRatio} onchange={(value) => (aspectRatio = value)} compact />
				</div>

				<div class="space-y-2">
					<p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Resolução</p>
					<ResolutionSelector value={resolution} onchange={(value) => (resolution = value)} compact />
				</div>
			</div>
		</aside>

		<main class="flex min-h-0 flex-1 flex-col">
			{#if !sourceMediaId}
				<div class="flex flex-1 items-center justify-center">
					<div class="text-center">
						<p class="text-sm text-muted-foreground">Nenhuma imagem selecionada.</p>
						<Button class="mt-4" variant="outline" onclick={() => goto("/images")}>Voltar</Button>
					</div>
				</div>
			{:else if sourceMediaQuery.isLoading || !sourceMedia}
				<div class="flex flex-1 items-center justify-center">
					<div class="flex flex-col items-center gap-4">
						<svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						<p class="text-sm text-muted-foreground">Carregando imagem...</p>
					</div>
				</div>
			{:else}
				<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
					<div class="flex flex-1 items-center justify-center overflow-y-auto p-8">
						<div class="mx-auto flex w-full max-w-4xl flex-col items-center">
							<div class="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_20px_60px_rgba(0,0,0,0.24)]" style={`width: min(100%, 520px); aspect-ratio: ${getMediaAspectRatio()};`}>
								{#if sourceMedia.url}
									<img src={sourceMedia.url} alt={sourceMedia.userPrompt ?? sourceMedia.prompt ?? "Imagem de origem"} class="h-full w-full object-cover" />
								{/if}
							</div>

							<div class="mt-4 text-center">
								<p class="text-base font-semibold text-foreground">{getModelDisplayName(sourceMedia.model)}</p>
								<p class="mt-1 text-sm text-muted-foreground">{sourceMedia.width} × {sourceMedia.height}</p>
							</div>
						</div>
					</div>

					<div class="shrink-0 border-t border-border bg-background/95 p-4 backdrop-blur-md">
						<div class="mx-auto flex w-full max-w-3xl items-end gap-3">
							<Textarea
								bind:value={editPrompt}
								placeholder="Descreva sua edição..."
								class="min-h-[88px] resize-none bg-background"
							/>
							<Button
								class="h-11 shrink-0 px-5"
								disabled={!editPrompt.trim() || selectedModels.length === 0 || isStarting}
								onclick={handleStartConversation}
							>
								{#if isStarting}
									<svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
								{:else}
									Gerar
								{/if}
							</Button>
						</div>
						<p class="mx-auto mt-2 max-w-3xl text-xs text-muted-foreground">
							<kbd class="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Cmd</kbd>+<kbd class="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd> para iniciar a conversa
						</p>
					</div>
				</div>
			{/if}
		</main>
	</div>
</div>
