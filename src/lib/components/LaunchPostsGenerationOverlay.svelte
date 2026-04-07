<script lang="ts">
	import { goto } from "$app/navigation";
	import { useQuery } from "convex-svelte";
	import { api } from "../../convex/_generated/api.js";
	import type { Doc } from "../../convex/_generated/dataModel.js";
	import { pendingLaunchPosts } from "$lib/studio/pendingLaunchPostsStore";
	import { get } from "svelte/store";
	import {
		Sparkles,
		Lightbulb,
		Image as ImageIcon,
		FileText,
		CalendarClock,
		ChevronRight,
		Minimize2,
		Maximize2,
	} from "lucide-svelte";

	type Gen = NonNullable<Doc<"projects">["launchPostsGeneration"]>;

	const summariesQuery = useQuery(api.projects.listSummaries, () => ({}));

	let pendingIds = $state<ReadonlySet<string>>(get(pendingLaunchPosts));
	$effect(() => {
		const unsub = pendingLaunchPosts.subscribe((s) => {
			pendingIds = s;
		});
		return unsub;
	});

	let projects = $derived(summariesQuery.data ?? []);

	let active = $derived.by(() => {
		for (const p of projects) {
			const gen = p.launchPostsGeneration;
			if (gen?.status === "generating") {
				return { project: p, gen, mode: "convex" as const };
			}
		}
		for (const p of projects) {
			if (pendingIds.has(p._id) && !p.launchPostsGeneration) {
				return { project: p, gen: null as Gen | null, mode: "pending" as const };
			}
		}
		return null;
	});

	let minimized = $state(false);

	$effect(() => {
		if (!active) {
			minimized = false;
			return;
		}
		const key = `launchOverlayMin:${active.project._id}`;
		if (typeof sessionStorage !== "undefined") {
			minimized = sessionStorage.getItem(key) === "1";
		}
	});

	function setMinimized(next: boolean) {
		if (!active) return;
		const key = `launchOverlayMin:${active.project._id}`;
		if (typeof sessionStorage === "undefined") return;
		if (next) {
			sessionStorage.setItem(key, "1");
		} else {
			sessionStorage.removeItem(key);
		}
		minimized = next;
	}

	function formatSchedule(ms: number): string {
		return new Date(ms).toLocaleString("pt-BR", {
			weekday: "long",
			day: "2-digit",
			month: "short",
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	type Step = { id: string; label: string; icon: typeof Lightbulb };

	const steps: Step[] = [
		{ id: "ideas", label: "Ideias", icon: Lightbulb },
		{ id: "image", label: "Imagem", icon: ImageIcon },
		{ id: "post", label: "Post", icon: FileText },
		{ id: "schedule", label: "Agenda", icon: CalendarClock },
	];

	let stepIndex = $derived.by(() => {
		if (!active) return 0;
		if (active.mode === "pending" || active.gen?.phase === "ideas" || !active.gen?.phase) {
			return 0;
		}
		const p = active.gen?.phase;
		if (p === "image") return 1;
		if (p === "post") return 2;
		if (p === "schedule") return 3;
		return 0;
	});

	let headline = $derived.by(() => {
		if (!active) return "";
		if (active.mode === "pending") {
			return "Preparando a geração automática…";
		}
		const gen = active.gen;
		if (!gen) return "";
		if (gen.phase === "ideas" || !gen.phase) {
			return "Montando 5 ideias com base no seu Instagram";
		}
		const n = gen.activePostNumber ?? gen.completedPosts + 1;
		if (gen.phase === "image") {
			return `Gerando imagem · post ${n} de ${gen.totalPosts}`;
		}
		if (gen.phase === "post") {
			return `Montando legenda e rascunho · post ${n} de ${gen.totalPosts}`;
		}
		if (gen.phase === "schedule") {
			return `Agendando no calendário · post ${n} de ${gen.totalPosts}`;
		}
		return "Gerando posts automáticos";
	});

	let promptBlock = $derived.by(() => {
		if (!active) {
			return { title: "", body: null as string | null };
		}
		if (active.mode === "pending" || !active.gen) {
			return {
				title: "Status",
				body: "Entrando na fila de geração e reservando recursos de IA…",
			};
		}
		const gen = active.gen;
		if (gen.phase === "ideas" || !gen.phase) {
			return {
				title: "Pedido",
				body: "Monte um pacote inicial de demonstração com 5 posts distintos, prontos para agendamento, variando ângulo editorial e evitando repetição de tema.",
			};
		}
		if (gen.phase === "image") {
			return {
				title: "Brief de imagem (inglês)",
				body: gen.currentImagePrompt ?? null,
			};
		}
		if (gen.phase === "post") {
			return {
				title: "Legenda do post",
				body: gen.currentCaption ?? null,
			};
		}
		if (gen.phase === "schedule" && gen.scheduledFor != null) {
			return {
				title: "Horário",
				body: formatSchedule(gen.scheduledFor),
			};
		}
		return { title: "", body: null };
	});

	let progressPct = $derived.by(() => {
		if (!active?.gen) return 0;
		const g = active.gen;
		return Math.round(
			Math.min(100, Math.max(0, (g.completedPosts / Math.max(g.totalPosts, 1)) * 100))
		);
	});
</script>

{#if active}
	{#if minimized}
		<div
			class="pointer-events-auto fixed bottom-6 right-6 z-[100] flex max-w-sm flex-col gap-2 rounded-none border border-primary/30 bg-card/95 p-3 shadow-2xl shadow-primary/10 backdrop-blur-md"
		>
			<div class="flex items-center gap-2">
				<Sparkles class="h-4 w-4 shrink-0 text-primary" />
				<p class="text-xs font-medium leading-tight">Gerando posts · {active.project.name}</p>
				<button
					type="button"
					class="ml-auto rounded-none p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
					aria-label="Expandir painel de progresso"
					onclick={() => setMinimized(false)}
				>
					<Maximize2 class="h-4 w-4" />
				</button>
			</div>
			<div class="h-1 w-full overflow-hidden bg-muted">
				<div
					class="h-full bg-primary transition-[width] duration-300 ease-out"
					style={`width: ${progressPct}%`}
				></div>
			</div>
			<button
				type="button"
				class="text-left text-[10px] text-muted-foreground underline-offset-2 hover:underline"
				onclick={() => goto(`/projects/${active.project._id}`)}
			>
				Ir para o projeto
			</button>
		</div>
	{:else}
		<div
			class="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none"
			aria-live="polite"
			aria-busy="true"
		>
			<div
				class="absolute inset-0 bg-gradient-to-b from-background/90 via-background/85 to-background/92 backdrop-blur-md"
				aria-hidden="true"
			></div>

			<div
				class="pointer-events-auto relative flex max-h-[min(92vh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-none border border-border/80 bg-card shadow-2xl shadow-primary/10"
			>
				<div
					class="flex items-center justify-between border-b border-border/50 bg-muted/20 px-4 py-3"
				>
					<div class="flex flex-col gap-0.5">
						<p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
							Geração automática
						</p>
						<h2 class="text-sm font-semibold tracking-tight">{active.project.name}</h2>
					</div>
					<div class="flex items-center gap-1">
						<button
							type="button"
							class="rounded-none p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							aria-label="Minimizar e continuar no app"
							onclick={() => setMinimized(true)}
						>
							<Minimize2 class="h-4 w-4" />
						</button>
					</div>
				</div>

				<div class="flex flex-col gap-6 overflow-y-auto p-5 md:p-6">
					<div class="flex flex-wrap items-center justify-between gap-2">
						{#each steps as step, i (step.id)}
							{@const StepIcon = step.icon}
							<div class="flex min-w-0 flex-1 items-center gap-2">
								<div
									class="flex h-9 w-9 shrink-0 items-center justify-center border transition-colors {i <= stepIndex
										? 'border-primary bg-primary/10 text-primary'
										: 'border-border bg-muted/40 text-muted-foreground'}"
								>
									<StepIcon class="h-4 w-4" />
								</div>
								<div class="min-w-0">
									<p
										class="text-[10px] font-medium uppercase tracking-wider {i === stepIndex
											? 'text-primary'
											: 'text-muted-foreground'}"
									>
										{step.label}
									</p>
								</div>
								{#if i < steps.length - 1}
									<ChevronRight class="mx-1 hidden h-4 w-4 shrink-0 text-muted-foreground/30 sm:block" />
								{/if}
							</div>
						{/each}
					</div>

					<div class="flex items-start gap-3">
						<div
							class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center border border-primary/25 bg-primary/5"
						>
							<Sparkles class="h-5 w-5 text-primary animate-pulse" />
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-lg font-medium leading-snug tracking-tight">
								{headline}
							</p>
							{#if active.gen}
								<p class="mt-1 text-xs text-muted-foreground">
									{active.gen.completedPosts} de {active.gen.totalPosts} concluídos · você pode navegar
									pelo app; o progresso continua em tempo real.
								</p>
							{:else}
								<p class="mt-1 text-xs text-muted-foreground">
									Conectando ao servidor… você pode navegar em seguida.
								</p>
							{/if}
						</div>
					</div>

					<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
						<div
							class="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-[width] duration-500 ease-out"
							style={`width: ${progressPct}%`}
						></div>
					</div>

					{#if promptBlock.body}
						<div class="space-y-2 border border-border/60 bg-muted/15 px-4 py-3">
							<p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
								{promptBlock.title}
							</p>
							<p class="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
								{promptBlock.body}
							</p>
						</div>
					{/if}

					<div class="flex flex-wrap gap-2 pt-1">
						<button
							type="button"
							class="rounded-none border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
							onclick={() => goto(`/projects/${active.project._id}`)}
						>
							Abrir projeto
						</button>
						<button
							type="button"
							class="rounded-none border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
							onclick={() => goto("/calendar")}
						>
							Ver calendário
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
{/if}
