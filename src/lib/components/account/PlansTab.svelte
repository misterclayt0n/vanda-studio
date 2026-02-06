<script lang="ts">
	import { Button, Badge } from "$lib/components/ui";

	interface SubscriptionData {
		subscription: {
			plan: string;
			promptsUsed: number;
			promptsLimit: number;
			periodEnd?: number;
			trialEndsAt?: number;
			resetAt?: number;
		};
		accessStatus: string;
		trialEligible: boolean;
	}

	interface Props {
		subscriptionData: SubscriptionData | null;
		isLoading: boolean;
		expired: boolean;
		onUpgrade: (planId: "basico" | "mediano" | "profissional") => Promise<void>;
		onManageBilling: () => Promise<void>;
		isUpgrading: string | null;
		upgradeError: string | null;
		isOpeningPortal: boolean;
		portalError: string | null;
	}

	let {
		subscriptionData,
		isLoading,
		expired,
		onUpgrade,
		onManageBilling,
		isUpgrading,
		upgradeError,
		isOpeningPortal,
		portalError,
	}: Props = $props();

	const plans = [
		{
			id: "basico" as const,
			name: "Basico",
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

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString("pt-BR", {
			day: "numeric",
			month: "long",
			year: "numeric",
		});
	}

	function isCurrentPlan(planId: string): boolean {
		return subscriptionData?.subscription?.plan === planId;
	}

	function isUpgrade(planId: string): boolean {
		const currentPlan = subscriptionData?.subscription?.plan;
		if (!currentPlan) return true;
		const planOrder = ["basico", "mediano", "profissional"];
		return planOrder.indexOf(planId) > planOrder.indexOf(currentPlan);
	}
</script>

<div class="space-y-6">
	<div>
		<h3 class="text-lg font-semibold mb-1">Planos e assinatura</h3>
		<p class="text-sm text-muted-foreground">
			Escolha o plano ideal para sua necessidade
		</p>
	</div>

	{#if expired}
		<div class="border border-amber-500/30 bg-amber-500/10 p-4">
			<p class="text-sm text-amber-600">Sessao de checkout expirada. Tente novamente.</p>
		</div>
	{/if}

	{#if upgradeError}
		<div class="border border-red-500/30 bg-red-500/10 p-4">
			<p class="text-sm text-red-600">{upgradeError}</p>
		</div>
	{/if}

	{#if portalError}
		<div class="border border-red-500/30 bg-red-500/10 p-4">
			<p class="text-sm text-red-600">{portalError}</p>
		</div>
	{/if}

	{#if isLoading}
		<div class="grid gap-4 md:grid-cols-3">
			{#each [1, 2, 3] as _}
				<div class="border border-border bg-card p-6 space-y-4">
					<div class="h-6 w-24 bg-muted animate-pulse"></div>
					<div class="h-8 w-32 bg-muted animate-pulse"></div>
					<div class="space-y-2">
						<div class="h-4 w-full bg-muted animate-pulse"></div>
						<div class="h-4 w-3/4 bg-muted animate-pulse"></div>
						<div class="h-4 w-5/6 bg-muted animate-pulse"></div>
					</div>
					<div class="h-9 w-full bg-muted animate-pulse"></div>
				</div>
			{/each}
		</div>
	{:else}
		<!-- Plan cards -->
		<div class="grid gap-4 md:grid-cols-3">
			{#each plans as plan}
				<div class="relative flex flex-col border bg-card p-6 transition-all hover:border-primary/30
					{plan.highlight ? 'border-2 border-primary' : 'border-border'}
					{isCurrentPlan(plan.id) ? 'ring-2 ring-green-500' : ''}">

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
						<h4 class="text-xl font-semibold font-serif">{plan.name}</h4>
						<p class="text-sm text-muted-foreground">{plan.description}</p>
					</div>

					<div class="mb-4">
						<span class="text-3xl font-bold">R$ {plan.price}</span>
						<span class="text-muted-foreground">/mes</span>
					</div>

					<div class="mb-4 flex items-center gap-2 bg-muted/50 p-3">
						<svg class="h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
						</svg>
						<span class="font-semibold text-sm">{plan.images} imagens/mes</span>
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
							class="w-full"
							variant={plan.highlight ? "default" : "outline"}
							onclick={() => onUpgrade(plan.id)}
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

		<!-- Payment info -->
		<p class="text-center text-sm text-muted-foreground">
			Pague com PIX ou cartao de credito
		</p>

		<!-- Manage billing -->
		{#if subscriptionData?.subscription?.plan}
			<div class="border border-border bg-card p-6">
				<div class="flex items-center justify-between">
					<div>
						<h4 class="font-medium">Gerenciar assinatura</h4>
						<p class="text-sm text-muted-foreground">
							Alterar metodo de pagamento, cancelar ou ver faturas
						</p>
					</div>
					<Button variant="outline" onclick={onManageBilling} disabled={isOpeningPortal}>
						{#if isOpeningPortal}
							<svg class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
							</svg>
							Abrindo...
						{:else}
							<svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
							</svg>
							Gerenciar cobranca
						{/if}
					</Button>
				</div>
			</div>
		{/if}
	{/if}
</div>
