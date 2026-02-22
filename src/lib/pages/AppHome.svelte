<script lang="ts">
	import { SignedIn, SignedOut, SignInButton, useClerkContext } from "svelte-clerk";
	import { useQuery } from "convex-svelte";
	import { api } from "../../convex/_generated/api.js";
	import Navbar from "$lib/components/Navbar.svelte";
	import { Button, Badge } from "$lib/components/ui";
	import { goto } from "$app/navigation";
	import { CreateProjectModal } from "$lib/components/projects";

	const clerk = useClerkContext();

	const projects = useQuery(api.projects.list, {});
	const stats = useQuery(api.scheduledPosts.getSchedulingStats, {});
	const recentPosts = useQuery(api.generatedPosts.listByUser, { limit: 6 });
	const upcomingPosts = useQuery(api.scheduledPosts.getUpcomingPosts, { limit: 5 });

	let showCreateModal = $state(false);

	// Onboarding step tracker (persisted in localStorage)
	let onboardingDismissed = $state(false);

	$effect(() => {
		if (typeof window !== "undefined") {
			onboardingDismissed = localStorage.getItem("vanda_onboarding_dismissed") === "true";
		}
	});

	function dismissOnboarding() {
		onboardingDismissed = true;
		if (typeof window !== "undefined") {
			localStorage.setItem("vanda_onboarding_dismissed", "true");
		}
	}

	let hasProjects = $derived(
		!projects.isLoading && projects.data && projects.data.length > 0
	);

	let totalPosts = $derived(
		recentPosts.data?.posts?.length ?? 0
	);

	let firstName = $derived(
		clerk.user?.firstName ?? clerk.user?.fullName?.split(" ")[0] ?? ""
	);

	function formatScheduledDate(timestamp: number): string {
		const date = new Date(timestamp);
		const now = new Date();
		const tomorrow = new Date(now);
		tomorrow.setDate(tomorrow.getDate() + 1);

		const isToday = date.toDateString() === now.toDateString();
		const isTomorrow = date.toDateString() === tomorrow.toDateString();

		const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

		if (isToday) return `Hoje, ${time}`;
		if (isTomorrow) return `Amanhã, ${time}`;

		return date.toLocaleDateString("pt-BR", {
			day: "numeric",
			month: "short",
		}) + `, ${time}`;
	}

	function truncateCaption(caption: string, maxLength: number = 80): string {
		if (caption.length <= maxLength) return caption;
		return caption.substring(0, maxLength).trimEnd() + "...";
	}

	const onboardingSteps = [
		{
			number: "01",
			title: "Crie um projeto",
			description: "Conecte uma conta do Instagram para usar como referência de estilo e tom.",
			action: "Novo projeto",
			href: null as string | null,
			openModal: true,
		},
		{
			number: "02",
			title: "Gere posts com IA",
			description: "Crie legendas e imagens únicas usando inteligência artificial.",
			action: "Criar post",
			href: "/posts/create",
			openModal: false,
		},
		{
			number: "03",
			title: "Agende e publique",
			description: "Organize seus posts no calendário e nunca perca o timing.",
			action: "Ver calendário",
			href: "/calendar",
			openModal: false,
		},
	];
</script>

<svelte:head>
	<title>Vanda Studio</title>
</svelte:head>

<div class="flex h-screen flex-col bg-background">
	<Navbar />

	<main class="flex-1 overflow-y-auto">
		<SignedOut>
			<!-- Unauthenticated landing -->
			<div class="relative flex flex-col items-center justify-center gap-8 px-4 py-24">
				<!-- Decorative line -->
				<div class="absolute top-12 left-1/2 h-px w-48 -translate-x-1/2 bg-gradient-to-r from-transparent via-primary/40 to-transparent"></div>

				<div class="text-center max-w-lg">
					<p class="text-xs font-medium uppercase tracking-[0.3em] text-primary mb-4">Estúdio criativo</p>
					<h1 class="text-4xl md:text-5xl font-serif font-bold leading-tight">
						Posts para Instagram<br />
						<span class="text-primary">feitos com IA</span>
					</h1>
					<p class="mt-4 text-muted-foreground leading-relaxed">
						Gere legendas, imagens e agende publicações para suas contas do Instagram — tudo em um só lugar.
					</p>
				</div>

				<SignInButton mode="modal">
					<button class="btn-glow h-11 border border-primary bg-primary px-8 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90">
						Começar agora
					</button>
				</SignInButton>

				<!-- Feature pills -->
				<div class="flex flex-wrap justify-center gap-2 mt-4">
					{#each ["Legendas com IA", "Geração de imagens", "Agendamento", "Multi-contas"] as feature}
						<span class="border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
							{feature}
						</span>
					{/each}
				</div>
			</div>
		</SignedOut>

		<SignedIn>
			<div class="mx-auto max-w-6xl px-4 py-8 space-y-8">

				<!-- Header -->
				<div class="flex items-start justify-between gap-4">
					<div>
						{#if firstName}
							<h1 class="text-2xl font-serif font-semibold">
								Olá, {firstName}
							</h1>
						{:else}
							<h1 class="text-2xl font-serif font-semibold">
								Painel
							</h1>
						{/if}
						<p class="text-sm text-muted-foreground mt-1">
							{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
						</p>
					</div>

					<!-- Quick actions -->
					<div class="flex items-center gap-2">
						<Button variant="outline" size="sm" onclick={() => goto("/calendar")}>
							<svg class="h-4 w-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
							</svg>
							Calendário
						</Button>
						<Button size="sm" onclick={() => goto("/posts/create")}>
							<svg class="h-4 w-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
							</svg>
							Criar post
						</Button>
					</div>
				</div>

				<!-- Onboarding (new users or not dismissed) -->
				{#if !hasProjects && !onboardingDismissed}
					<div class="border border-border bg-card">
						<div class="flex items-center justify-between border-b border-border px-6 py-4">
							<div>
								<h2 class="text-lg font-serif font-semibold">Como funciona</h2>
								<p class="text-sm text-muted-foreground">Comece em 3 passos simples</p>
							</div>
							{#if hasProjects}
								<button
									class="text-xs text-muted-foreground hover:text-foreground transition-colors"
									onclick={dismissOnboarding}
								>
									Fechar
								</button>
							{/if}
						</div>

						<div class="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
							{#each onboardingSteps as step, i}
								<div class="p-6 flex flex-col gap-4 group">
									<div class="flex items-center gap-3">
										<span class="text-2xl font-serif font-bold text-primary/60">{step.number}</span>
										<div class="h-px flex-1 bg-border"></div>
									</div>
									<div class="flex-1">
										<h3 class="font-medium text-sm mb-1">{step.title}</h3>
										<p class="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
									</div>
									<Button
										variant={i === 0 ? "default" : "outline"}
										size="sm"
										onclick={() => {
											if (step.openModal) showCreateModal = true;
											else if (step.href) goto(step.href);
										}}
									>
										{step.action}
									</Button>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Stats row -->
				{#if hasProjects}
					<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
						<!-- Projects count -->
						<div class="border border-border bg-card p-5 transition-shadow hover:shadow-md">
							<div class="flex items-center gap-2 mb-3">
								<svg class="h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
								</svg>
								<span class="text-xs text-muted-foreground uppercase tracking-wider">Projetos</span>
							</div>
							<p class="text-2xl font-bold font-serif">
								{projects.data?.length ?? 0}
							</p>
						</div>

						<!-- Scheduled -->
						<div class="border border-border bg-card p-5 transition-shadow hover:shadow-md">
							<div class="flex items-center gap-2 mb-3">
								<svg class="h-4 w-4 text-info" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<span class="text-xs text-muted-foreground uppercase tracking-wider">Agendados</span>
							</div>
							<p class="text-2xl font-bold font-serif">
								{#if stats.isLoading}
									<span class="inline-block h-7 w-8 bg-muted animate-pulse"></span>
								{:else}
									{stats.data?.scheduled ?? 0}
								{/if}
							</p>
						</div>

						<!-- Posted -->
						<div class="border border-border bg-card p-5 transition-shadow hover:shadow-md">
							<div class="flex items-center gap-2 mb-3">
								<svg class="h-4 w-4 text-success" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<span class="text-xs text-muted-foreground uppercase tracking-wider">Publicados</span>
							</div>
							<p class="text-2xl font-bold font-serif">
								{#if stats.isLoading}
									<span class="inline-block h-7 w-8 bg-muted animate-pulse"></span>
								{:else}
									{stats.data?.posted ?? 0}
								{/if}
							</p>
						</div>

						<!-- Missed -->
						<div class="border border-border bg-card p-5 transition-shadow hover:shadow-md">
							<div class="flex items-center gap-2 mb-3">
								<svg class="h-4 w-4 text-warning" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
								</svg>
								<span class="text-xs text-muted-foreground uppercase tracking-wider">Perdidos</span>
							</div>
							<p class="text-2xl font-bold font-serif">
								{#if stats.isLoading}
									<span class="inline-block h-7 w-8 bg-muted animate-pulse"></span>
								{:else}
									{stats.data?.missed ?? 0}
								{/if}
							</p>
						</div>
					</div>
				{/if}

				<!-- Main content grid -->
				<div class="grid md:grid-cols-3 gap-6">
					<!-- Left column: Projects + Recent posts (2/3) -->
					<div class="md:col-span-2 space-y-6">

						<!-- Projects section -->
						<div class="border border-border bg-card">
							<div class="flex items-center justify-between px-5 py-4 border-b border-border">
								<div class="flex items-center gap-2">
									<h2 class="text-sm font-semibold">Projetos</h2>
									{#if projects.data}
										<Badge variant="secondary">{projects.data.length}</Badge>
									{/if}
								</div>
								<div class="flex items-center gap-2">
									<Button variant="ghost" size="sm" onclick={() => goto("/projects")}>
										Ver todos
									</Button>
									<Button variant="outline" size="sm" onclick={() => showCreateModal = true}>
										<svg class="h-3.5 w-3.5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
										</svg>
										Novo
									</Button>
								</div>
							</div>

							{#if projects.isLoading}
								<div class="p-5 space-y-3">
									{#each [1, 2] as _}
										<div class="flex items-center gap-3">
											<div class="h-10 w-10 bg-muted animate-pulse rounded-full shrink-0"></div>
											<div class="flex-1 space-y-1.5">
												<div class="h-4 w-32 bg-muted animate-pulse"></div>
												<div class="h-3 w-48 bg-muted animate-pulse"></div>
											</div>
										</div>
									{/each}
								</div>
							{:else if projects.data && projects.data.length > 0}
								<div class="divide-y divide-border">
									{#each projects.data as project}
										<button
											class="flex items-center gap-3 w-full px-5 py-3.5 text-left transition-colors hover:bg-muted/50"
											onclick={() => goto(`/projects/${project._id}`)}
										>
											<!-- Avatar -->
											<div class="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
												{#if project.profilePictureStorageUrl ?? project.profilePictureUrl}
													<img
														src={project.profilePictureStorageUrl ?? project.profilePictureUrl}
														alt={project.name}
														class="h-full w-full object-cover"
													/>
												{:else}
													<div class="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
														{project.name.charAt(0).toUpperCase()}
													</div>
												{/if}
												{#if project.isFetching}
													<div class="absolute inset-0 flex items-center justify-center bg-black/40">
														<svg class="h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
															<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
															<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
														</svg>
													</div>
												{/if}
											</div>

											<!-- Info -->
											<div class="flex-1 min-w-0">
												<p class="text-sm font-medium truncate">{project.name}</p>
												{#if project.instagramHandle}
													<p class="text-xs text-muted-foreground">@{project.instagramHandle}</p>
												{:else}
													<p class="text-xs text-muted-foreground truncate">{project.instagramUrl}</p>
												{/if}
											</div>

											<!-- Arrow -->
											<svg class="h-4 w-4 text-muted-foreground/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
											</svg>
										</button>
									{/each}
								</div>
							{:else}
								<div class="p-8 text-center">
									<div class="inline-flex h-12 w-12 items-center justify-center border border-dashed border-border mb-3">
										<svg class="h-5 w-5 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
										</svg>
									</div>
									<p class="text-sm text-muted-foreground mb-3">Nenhum projeto ainda</p>
									<Button size="sm" onclick={() => showCreateModal = true}>
										Criar primeiro projeto
									</Button>
								</div>
							{/if}
						</div>

						<!-- Recent posts -->
						{#if hasProjects}
							<div class="border border-border bg-card">
								<div class="flex items-center justify-between px-5 py-4 border-b border-border">
									<h2 class="text-sm font-semibold">Posts recentes</h2>
									<Button variant="ghost" size="sm" onclick={() => goto("/gallery")}>
										Ver galeria
									</Button>
								</div>

								{#if recentPosts.isLoading}
									<div class="grid grid-cols-3 gap-px bg-border">
										{#each [1, 2, 3] as _}
											<div class="aspect-square bg-muted animate-pulse"></div>
										{/each}
									</div>
								{:else if recentPosts.data?.posts && recentPosts.data.posts.length > 0}
									<div class="grid grid-cols-3 gap-px bg-border">
										{#each recentPosts.data.posts.slice(0, 6) as post}
											<button
												class="group relative aspect-square bg-muted overflow-hidden"
												onclick={() => goto(`/posts/${post._id}`)}
											>
												{#if post.imageUrl}
													<img
														src={post.imageUrl}
														alt={post.caption ? truncateCaption(post.caption, 40) : "Post gerado"}
														class="h-full w-full object-cover transition-transform group-hover:scale-105"
													/>
												{:else}
													<div class="flex h-full w-full items-center justify-center">
														<svg class="h-6 w-6 text-muted-foreground/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
														</svg>
													</div>
												{/if}
												<!-- Hover overlay -->
												<div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end p-2 opacity-0 group-hover:opacity-100">
													{#if post.caption}
														<p class="text-[10px] text-white leading-tight line-clamp-2">
															{truncateCaption(post.caption, 60)}
														</p>
													{/if}
												</div>
												<!-- Status badge -->
												{#if post.schedulingStatus === "scheduled"}
													<div class="absolute top-1.5 right-1.5">
														<span class="inline-flex h-2 w-2 bg-info"></span>
													</div>
												{:else if post.schedulingStatus === "posted"}
													<div class="absolute top-1.5 right-1.5">
														<span class="inline-flex h-2 w-2 bg-success"></span>
													</div>
												{/if}
											</button>
										{/each}
									</div>
								{:else}
									<div class="p-8 text-center">
										<p class="text-sm text-muted-foreground mb-3">Nenhum post gerado ainda</p>
										<Button variant="outline" size="sm" onclick={() => goto("/posts/create")}>
											Criar primeiro post
										</Button>
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Right column: Upcoming + Quick links (1/3) -->
					<div class="space-y-6">
						<!-- Upcoming scheduled -->
						{#if hasProjects}
							<div class="border border-border bg-card">
								<div class="flex items-center justify-between px-5 py-4 border-b border-border">
									<h2 class="text-sm font-semibold">Próximos agendamentos</h2>
								</div>

								{#if upcomingPosts.isLoading}
									<div class="p-5 space-y-3">
										{#each [1, 2, 3] as _}
											<div class="flex items-center gap-3">
												<div class="h-10 w-10 bg-muted animate-pulse shrink-0"></div>
												<div class="flex-1 space-y-1.5">
													<div class="h-3 w-24 bg-muted animate-pulse"></div>
													<div class="h-3 w-36 bg-muted animate-pulse"></div>
												</div>
											</div>
										{/each}
									</div>
								{:else if upcomingPosts.data && upcomingPosts.data.length > 0}
									<div class="divide-y divide-border">
										{#each upcomingPosts.data as post}
											<button
												class="flex items-center gap-3 w-full px-5 py-3 text-left transition-colors hover:bg-muted/50"
												onclick={() => goto(`/posts/${post._id}`)}
											>
												<!-- Thumbnail -->
												<div class="h-10 w-10 shrink-0 overflow-hidden bg-muted border border-border">
													{#if post.imageUrl}
														<img
															src={post.imageUrl}
															alt=""
															class="h-full w-full object-cover"
														/>
													{:else}
														<div class="flex h-full w-full items-center justify-center">
															<svg class="h-4 w-4 text-muted-foreground/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
																<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
															</svg>
														</div>
													{/if}
												</div>

												<div class="flex-1 min-w-0">
													<p class="text-xs text-primary font-medium">
														{formatScheduledDate(post.scheduledFor!)}
													</p>
													{#if post.caption}
														<p class="text-xs text-muted-foreground truncate mt-0.5">
															{truncateCaption(post.caption, 50)}
														</p>
													{/if}
												</div>
											</button>
										{/each}
									</div>

									<div class="px-5 py-3 border-t border-border">
										<Button variant="ghost" size="sm" class="w-full text-xs" onclick={() => goto("/calendar")}>
											Ver calendário completo
										</Button>
									</div>
								{:else}
									<div class="p-6 text-center">
										<svg class="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
										</svg>
										<p class="text-xs text-muted-foreground mb-2">Sem agendamentos</p>
										<Button variant="outline" size="sm" class="text-xs" onclick={() => goto("/calendar")}>
											Agendar post
										</Button>
									</div>
								{/if}
							</div>
						{/if}

						<!-- Quick navigation -->
						<div class="border border-border bg-card">
							<div class="px-5 py-4 border-b border-border">
								<h2 class="text-sm font-semibold">Acesso rápido</h2>
							</div>
							<div class="divide-y divide-border">
								<button
									class="flex items-center gap-3 w-full px-5 py-3 text-left transition-colors hover:bg-muted/50"
									onclick={() => goto("/posts/create")}
								>
									<div class="flex h-8 w-8 items-center justify-center border border-border bg-primary/5">
										<svg class="h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
										</svg>
									</div>
									<div class="flex-1">
										<p class="text-sm font-medium">Criar post</p>
										<p class="text-xs text-muted-foreground">Gerar legenda e imagem com IA</p>
									</div>
								</button>

								<button
									class="flex items-center gap-3 w-full px-5 py-3 text-left transition-colors hover:bg-muted/50"
									onclick={() => goto("/gallery")}
								>
									<div class="flex h-8 w-8 items-center justify-center border border-border bg-primary/5">
										<svg class="h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
										</svg>
									</div>
									<div class="flex-1">
										<p class="text-sm font-medium">Galeria</p>
										<p class="text-xs text-muted-foreground">Navegar pelos posts gerados</p>
									</div>
								</button>

								<button
									class="flex items-center gap-3 w-full px-5 py-3 text-left transition-colors hover:bg-muted/50"
									onclick={() => showCreateModal = true}
								>
									<div class="flex h-8 w-8 items-center justify-center border border-border bg-primary/5">
										<svg class="h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
										</svg>
									</div>
									<div class="flex-1">
										<p class="text-sm font-medium">Novo projeto</p>
										<p class="text-xs text-muted-foreground">Conectar conta do Instagram</p>
									</div>
								</button>

								<button
									class="flex items-center gap-3 w-full px-5 py-3 text-left transition-colors hover:bg-muted/50"
									onclick={() => goto("/account")}
								>
									<div class="flex h-8 w-8 items-center justify-center border border-border bg-primary/5">
										<svg class="h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
										</svg>
									</div>
									<div class="flex-1">
										<p class="text-sm font-medium">Conta</p>
										<p class="text-xs text-muted-foreground">Configurações e assinatura</p>
									</div>
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</SignedIn>
	</main>
</div>

<CreateProjectModal
	open={showCreateModal}
	onclose={() => showCreateModal = false}
	oncreated={(id) => goto(`/projects/${id}`)}
/>
