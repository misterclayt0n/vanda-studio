<script lang="ts">
	import { Button, Badge } from "$lib/components/ui";
	import { SignedIn, SignedOut, SignInButton } from "svelte-clerk";
	import { useConvexClient, useQuery } from "convex-svelte";
	import { api } from "../../convex/_generated/api.js";
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import Navbar from "$lib/components/Navbar.svelte";

	const client = useConvexClient();

	// Check for URL params
	let expired = $derived($page.url.searchParams.get('expired') === 'true');

	type AccessStatus = "trialing" | "active" | "expired" | "trial_eligible" | "none";
	type SubscriptionData = {
		subscription: {
			plan: string;
			promptsUsed: number;
			promptsLimit: number;
			periodEnd?: number;
			trialEndsAt?: number;
		};
		accessStatus: AccessStatus;
		trialEligible: boolean;
	};

	// Query Autumn customer state
	const customerQuery = useQuery((api as any).billing.autumn.getAutumnCustomer, () => ({}));
	let customerData = $derived(customerQuery.data);
	let isLoading = $derived(customerQuery.isLoading);
	let subscriptionData = $state<SubscriptionData | null>(null);

	$effect(() => {
		if (!customerData) {
			subscriptionData = null;
			return;
		}

		const activeProduct = customerData.products?.find((product: any) =>
			product.status === "active" || product.status === "trialing"
		);

		const feature = customerData.features?.images_generated;
		const used = feature?.usage ?? 0;
		const limit = feature?.included_usage ?? feature?.usage_limit ?? feature?.balance ?? 0;

		subscriptionData = {
			subscription: {
				plan: activeProduct?.id ?? "",
				promptsUsed: used,
				promptsLimit: limit,
				periodEnd: activeProduct?.current_period_end ?? undefined,
				trialEndsAt: activeProduct?.trial_ends_at ?? undefined,
			},
			accessStatus: activeProduct?.status === "trialing"
				? "trialing"
				: activeProduct
					? "active"
					: "trial_eligible",
			trialEligible: !activeProduct,
		};
	});

	// Upgrade state
	let isUpgrading = $state<string | null>(null);
	let upgradeError = $state<string | null>(null);

	// Plan configurations
	const plans = [
		{
			id: "basico" as const,
			name: "Básico",
			description: "Para criadores iniciantes",
			price: 87,
			images: 75,
			features: [
				"75 imagens por mes",
				"Geracao de legendas com IA",
				"Todos os modelos de imagem",
				"Teste gratis de 7 dias",
				"Suporte por email",
			],
			highlight: true,
		},
		{
			id: "mediano" as const,
			name: "Mediano",
			description: "Para criadores serios",
			price: 149,
			images: 150,
			features: [
				"150 imagens por mes",
				"Geracao de legendas com IA",
				"Todos os modelos de imagem",
				"Suporte prioritario",
				"Acesso antecipado a novidades",
			],
			highlight: false,
		},
		{
			id: "profissional" as const,
			name: "Profissional",
			description: "Para agencias e times",
			price: 249,
			images: 300,
			features: [
				"300 imagens por mes",
				"Geracao de legendas com IA",
				"Todos os modelos de imagem",
				"Suporte prioritario",
				"Acesso antecipado a novidades",
				"Consultoria de uso",
			],
			highlight: false,
		},
	];

	// Handle upgrade click
	async function handleUpgrade(planId: "basico" | "mediano" | "profissional") {
		isUpgrading = planId;
		upgradeError = null;

		try {
			const result = await client.action((api as any).billing.autumn.startCheckout, {
				planId,
			});
			if (result?.checkoutUrl) {
				window.location.href = result.checkoutUrl;
				return;
			}

			const attachResult = await client.action((api as any).billing.autumn.attachPlan, {
				planId,
			});
			if (attachResult?.checkoutUrl) {
				window.location.href = attachResult.checkoutUrl;
				return;
			}

			goto('/billing/success');
		} catch (err) {
			upgradeError = err instanceof Error ? err.message : "Erro ao iniciar checkout";
			isUpgrading = null;
		}
	}

	// Format date
	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString('pt-BR', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
		});
	}

	// Check if user is on a specific plan
	function isCurrentPlan(planId: string): boolean {
		return subscriptionData?.subscription?.plan === planId;
	}

	// Check if plan is an upgrade from current
	function isUpgrade(planId: string): boolean {
		const currentPlan = subscriptionData?.subscription?.plan;
		if (!currentPlan) {
			return true;
		}
		const planOrder = ["basico", "mediano", "profissional"];
		return planOrder.indexOf(planId) > planOrder.indexOf(currentPlan);
	}
</script>

<svelte:head>
	<title>Planos - Vanda Studio</title>
</svelte:head>

<div class="flex h-screen flex-col bg-background">
	<Navbar />

	<SignedOut>
		<div class="flex flex-1 flex-col items-center justify-center gap-6 py-20">
			<div class="text-center">
				<h2 class="text-2xl font-bold">Entre para ver os planos</h2>
				<p class="mt-2 text-muted-foreground">
					Faca login para gerenciar sua assinatura
				</p>
			</div>
			<SignInButton mode="modal">
				<button class="h-9 rounded-none bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
					Entrar
				</button>
			</SignInButton>
		</div>
	</SignedOut>

	<SignedIn>
		<main class="flex-1 overflow-y-auto px-4 py-8">
			<div class="mx-auto max-w-6xl">
				<div class="mb-8 text-center">
					<h1 class="text-3xl font-bold">Escolha seu plano</h1>
					<p class="mt-2 text-muted-foreground">
						Desbloqueie todo o potencial do Vanda Studio
					</p>
				</div>

				{#if expired}
					<div class="mb-6 border border-amber-500/30 bg-amber-500/10 p-4 text-center">
						<p class="text-amber-600">Sessao de checkout expirada. Tente novamente.</p>
					</div>
				{/if}

				{#if upgradeError}
					<div class="mb-6 border border-red-500/30 bg-red-500/10 p-4 text-center">
						<p class="text-red-600">{upgradeError}</p>
					</div>
				{/if}

				{#if isLoading}
					<div class="flex justify-center py-12">
						<svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					</div>
				{:else}
					<!-- Plans Grid -->
					<div class="grid gap-6 lg:grid-cols-4 md:grid-cols-2">
						{#each plans as plan}
							<div class="relative flex flex-col border bg-card p-6 {plan.highlight ? 'border-2 border-primary' : 'border-border'} {isCurrentPlan(plan.id) ? 'ring-2 ring-green-500' : ''}">
								{#if plan.highlight}
									<div class="absolute -top-3 left-1/2 -translate-x-1/2">
										<Badge class="bg-primary text-primary-foreground">Mais popular</Badge>
									</div>
								{/if}

								{#if isCurrentPlan(plan.id)}
									<div class="absolute -top-3 right-4">
										<Badge class="bg-green-500 text-white">Atual</Badge>
									</div>
								{/if}

								<div class="mb-4">
									<h2 class="text-xl font-semibold">{plan.name}</h2>
									<p class="text-sm text-muted-foreground">{plan.description}</p>
								</div>

								<div class="mb-4">
									{#if plan.price === 0}
										<span class="text-3xl font-bold">Gratis</span>
									{:else}
										<span class="text-3xl font-bold">R$ {plan.price}</span>
										<span class="text-muted-foreground">/mes</span>
									{/if}
								</div>

								<div class="mb-4 flex items-center gap-2 rounded bg-muted/50 p-3">
									<svg class="h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
									</svg>
									<span class="font-semibold">{plan.images} imagens/mes</span>
								</div>

								<ul class="mb-6 flex-1 space-y-2">
									{#each plan.features as feature}
										<li class="flex items-start gap-2 text-sm">
											<svg class="mt-0.5 h-4 w-4 shrink-0 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
											</svg>
											<span>{feature}</span>
										</li>
									{/each}
								</ul>

								{#if isCurrentPlan(plan.id)}
									<div class="space-y-2">
										<Badge class="w-full justify-center py-2 bg-green-500/10 text-green-600 hover:bg-green-500/10">
											Plano ativo
										</Badge>
										{#if subscriptionData?.subscription?.periodEnd}
											<p class="text-center text-xs text-muted-foreground">
												Renova em {formatDate(subscriptionData.subscription.periodEnd)}
											</p>
										{/if}
									</div>
								{:else if isUpgrade(plan.id)}
									<Button
										class="w-full {plan.highlight ? '' : ''}"
										variant={plan.highlight ? "default" : "outline"}
										onclick={() => handleUpgrade(plan.id as "basico" | "mediano" | "profissional")}
										disabled={isUpgrading !== null}
									>
										{#if isUpgrading === plan.id}
											<svg class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
												<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
												<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
											</svg>
											Processando...
										{:else}
											Assinar {plan.name}
										{/if}
									</Button>
								{:else}
									<Button variant="outline" class="w-full" disabled>
										Plano inferior
									</Button>
								{/if}
							</div>
						{/each}
					</div>

					<!-- Payment methods info -->
					<div class="mt-8 text-center">
						<p class="text-sm text-muted-foreground">
							Pague com PIX ou cartao de credito
						</p>
					</div>

					<!-- Current Usage -->
					{#if subscriptionData?.subscription}
						<div class="mt-8 border border-border bg-card p-6">
							<h3 class="mb-4 font-medium">Uso atual</h3>
							<div class="flex items-center justify-between">
								<div>
									<p class="text-2xl font-bold">
										{subscriptionData.subscription.promptsUsed} / {subscriptionData.subscription.promptsLimit}
									</p>
									<p class="text-sm text-muted-foreground">imagens geradas este mes</p>
								</div>
								<div class="h-2 w-48 overflow-hidden bg-muted">
									<div
										class="h-full bg-primary transition-all"
										style="width: {Math.min(100, (subscriptionData.subscription.promptsUsed / subscriptionData.subscription.promptsLimit) * 100)}%"
									></div>
								</div>
							</div>
						</div>
					{/if}

					<!-- Back to app -->
					<div class="mt-8 text-center">
						<Button variant="ghost" onclick={() => goto('/posts/create')}>
							<svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
							</svg>
							Voltar para o app
						</Button>
					</div>
				{/if}
			</div>
		</main>
	</SignedIn>
</div>
