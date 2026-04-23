<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import { Button } from "$lib/components/ui";
	import { formatUserFacingMessage } from "$lib/errors";
	import { useConvexClient, useQuery } from "convex-svelte";
	import { SignedIn, SignedOut, SignInButton } from "svelte-clerk";
	import { Check, Loader2, Minus, Sparkles, XCircle } from "lucide-svelte";
	import { api } from "../../../../../convex/_generated/api.js";
	import type { Id } from "../../../../../convex/_generated/dataModel.js";

	type SetupStatus = "idle" | "syncing" | "intelligence" | "renaming" | "done" | "error";

	const client = useConvexClient();
	const projectId = $derived($page.params.projectId as Id<"projects">);
	const projectQuery = useQuery(api.projects.get, () => ({ projectId }));

	let status = $state<SetupStatus>("idle");
	let error = $state<string | null>(null);
	let started = $state(false);
	let importedCount = $state<number | null>(null);
	let skippedIntelligence = $state(false);

	const steps = $derived([
		{
			key: "syncing",
			label: "Importando posts e métricas",
			detail: importedCount === null ? "Buscando publicações recentes e dados da conta." : `${importedCount} posts importados.`,
			done: ["intelligence", "renaming", "done"].includes(status),
			active: status === "syncing",
			skipped: false,
		},
		{
			key: "intelligence",
			label: "Gerando estratégia inicial",
			detail: skippedIntelligence
				? "Sem posts importados ainda. A estratégia será gerada quando houver conteúdo."
				: "Extraindo pilares, audiência e padrões de conteúdo.",
			done: ["renaming", "done"].includes(status),
			active: status === "intelligence",
			skipped: skippedIntelligence,
		},
		{
			key: "renaming",
			label: "Organizando workspace da marca",
			detail: "Finalizando nome, conexão e estado do projeto.",
			done: status === "done",
			active: status === "renaming",
			skipped: false,
		},
	]);

	async function runSetup() {
		if (started) return;
		started = true;
		error = null;
		importedCount = null;
		skippedIntelligence = false;
		try {
			status = "syncing";
			const importResult = await client.action(api.instagramGraphActions.importProjectPosts, {
				projectId,
				limit: 30,
			});
			importedCount = importResult.importedCount;

			if (importResult.importedCount > 0) {
				status = "intelligence";
				await client.action(api.ai.socialIntelligence.regenerateBrandIntelligence, {
					projectId,
					limit: 30,
				});
			} else {
				skippedIntelligence = true;
			}

			status = "renaming";
			const latestProject = await client.query(api.projects.get, { projectId });
			const handle = latestProject?.instagramHandle ?? latestProject?.instagramConnection?.handle;
			const shouldRename =
				latestProject?.name === "Projeto do Instagram" ||
				latestProject?.name === "Novo projeto" ||
				latestProject?.name.trim().length === 0;
			if (latestProject && handle && shouldRename) {
				await client.mutation(api.projects.update, {
					projectId,
					name: handle,
					onboardingStatus: "complete",
					onboardingPath: "existing",
				});
			} else {
				await client.mutation(api.projects.update, {
					projectId,
					onboardingStatus: "complete",
					onboardingPath: "existing",
				});
			}

			status = "done";
		} catch (err) {
			console.error("[project-setup] failed", err);
			error = formatUserFacingMessage(err);
			status = "error";
		}
	}

	function retry() {
		started = false;
		status = "idle";
		void runSetup();
	}

	$effect(() => {
		const project = projectQuery.data;
		if (project?.instagramConnection?.status === "connected") {
			void runSetup();
		}
	});
</script>

<svelte:head>
	<title>Configurando projeto - Vanda Studio</title>
</svelte:head>

<div class="setup-stage min-h-screen bg-[#0f1014] text-zinc-100">
	<div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(236,72,153,0.18),transparent_32%),radial-gradient(circle_at_18%_78%,rgba(244,114,182,0.08),transparent_28%)]"></div>
	<div class="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-500/60 to-transparent"></div>

	<main class="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center px-6 py-16">
		<SignedOut>
			<section class="border border-zinc-800 bg-zinc-950/60 p-8 text-center">
				<h1 class="font-serif text-3xl font-semibold text-white">Entre para concluir</h1>
				<p class="mt-3 text-sm text-zinc-400">Faça login para finalizar a configuração do Instagram.</p>
				<SignInButton mode="modal">
					<Button class="mt-7 bg-pink-500 text-white hover:bg-pink-400">Entrar</Button>
				</SignInButton>
			</section>
		</SignedOut>

		<SignedIn>
			<section class="relative overflow-hidden border border-zinc-800 bg-zinc-950/70 p-9 shadow-2xl">
				<div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pink-500 via-pink-400 to-transparent"></div>
				<div class="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
					<div>
						<p class="text-xs font-medium uppercase tracking-[0.22em] text-pink-400">Instagram</p>
						<h1 class="mt-4 font-serif text-4xl font-semibold tracking-[-0.02em] text-white">
							{status === "done" ? "Projeto conectado" : status === "error" ? "Configuração incompleta" : "Conectando a marca"}
						</h1>
						<p class="mt-4 text-sm leading-6 text-zinc-400">
							{status === "done"
								? skippedIntelligence
									? "A conta foi conectada. Como não encontramos posts importáveis ainda, a estratégia será criada quando houver conteúdo."
									: "A conta foi conectada, os posts foram importados e a primeira leitura da marca está pronta."
								: status === "error"
									? "Algo falhou durante a importação. Você pode tentar novamente ou abrir o projeto e continuar depois."
									: "A Vanda está puxando os dados reais do Instagram para montar o workspace inicial."}
						</p>

						<div class="mt-8 border border-pink-500/25 bg-pink-500/[0.06] p-5">
							<p class="text-sm font-semibold text-pink-200">
								{projectQuery.data?.instagramConnection?.handle
									? `@${projectQuery.data.instagramConnection.handle}`
									: "Conta Instagram"}
							</p>
							<p class="mt-2 text-xs leading-5 text-zinc-400">
								Conexão oficial via Instagram API. Métricas e recomendações serão atualizadas conforme novos posts forem sincronizados.
							</p>
						</div>
					</div>

					<div class="relative pl-2">
						<div class="absolute bottom-7 left-[1.35rem] top-7 w-px bg-zinc-800"></div>
						<div class="space-y-7">
							{#each steps as step}
								<div class="relative flex gap-5">
									<div class="z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-zinc-950 {step.done ? 'border-pink-500 text-pink-300' : step.active ? 'border-pink-400 bg-pink-500/10 text-pink-300' : step.skipped ? 'border-zinc-700 text-zinc-500' : 'border-zinc-700 text-zinc-500'}">
										{#if step.skipped}
											<Minus class="h-5 w-5" />
										{:else if step.done}
											<Check class="h-5 w-5" />
										{:else if step.active}
											<Loader2 class="h-5 w-5 animate-spin" />
										{:else}
											<Sparkles class="h-5 w-5" />
										{/if}
									</div>
									<div class="min-w-0 pt-1">
										<p class="font-semibold text-white">{step.label}</p>
										<p class="mt-1 text-sm leading-5 {step.skipped ? 'text-zinc-500' : 'text-zinc-400'}">
											{step.detail}
										</p>
										<p class="mt-2 text-xs uppercase tracking-[0.18em] {step.active ? 'text-pink-400' : step.done ? 'text-pink-300/70' : 'text-zinc-600'}">
											{step.skipped ? "Pulado" : step.done ? "Concluído" : step.active ? "Em andamento" : "Aguardando"}
										</p>
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>

				{#if status === "error"}
					<div class="mt-6 flex items-start gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
						<XCircle class="mt-0.5 h-5 w-5 shrink-0" />
						<p>{error}</p>
					</div>
				{/if}

				<div class="mt-10 flex justify-end gap-3">
					{#if status === "done"}
						<Button variant="outline" onclick={() => goto("/projects")}>Voltar aos projetos</Button>
						<Button class="bg-pink-500 text-white hover:bg-pink-400" onclick={() => goto(`/projects/${projectId}`)}>
							Abrir projeto
						</Button>
					{:else if status === "error"}
						<Button variant="outline" onclick={() => goto("/projects")}>Voltar</Button>
						<Button class="bg-pink-500 text-white hover:bg-pink-400" onclick={retry}>Tentar novamente</Button>
					{:else}
						<Button variant="outline" disabled>
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Configurando
						</Button>
					{/if}
				</div>
			</section>
		</SignedIn>
	</main>
</div>
