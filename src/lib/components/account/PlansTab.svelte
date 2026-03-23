<script lang="ts">
	import { Button, Badge } from "$lib/components/ui";

	interface SubscriptionData {
		subscription: {
			plan: string;
			monthlyCreditsIncluded: number;
			monthlyCreditsUsed: number;
			monthlyCreditsRemaining: number;
			totalCreditsRemaining: number;
			periodEnd?: number;
			resetAt?: number;
		};
		accessStatus: string;
		trialEligible: boolean;
	}

	interface Props {
		subscriptionData: SubscriptionData | null;
		isLoading: boolean;
		expired: boolean;
		scheduledPlan: { id: string; startsAt: number } | null;
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
		scheduledPlan,
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
			name: "Básico",
			description: "Para quem está estruturando a rotina e precisa de espaço para criar com consistência.",
			price: 87,
			features: [
				"Limite mensal pensado para uso recorrente individual",
				"Todos os fluxos essenciais de imagem e legenda",
				"Todos os modelos de imagem incluídos",
				"7 dias grátis para testar sem fricção",
				"Suporte por email",
			],
			highlight: true,
		},
		{
			id: "mediano" as const,
			name: "Mediano",
			description: "Para quem publica com frequência, itera mais e quer mais liberdade no mês.",
			price: 149,
			features: [
				"Faixa mensal ampliada para produção constante",
				"Todos os modelos e estilos disponíveis",
				"Melhor cobertura para batches, testes e variações",
				"Suporte prioritário",
				"Acesso antecipado a novidades",
			],
			highlight: false,
		},
		{
			id: "profissional" as const,
			name: "Profissional",
			description: "Para times, estúdios e operações que precisam de folga para produzir pesado.",
			price: 249,
			features: [
				"Maior capacidade mensal para volume pesado",
				"Tudo do plano Mediano",
				"Mais conforto para campanhas, times e múltiplas frentes",
				"Suporte prioritário",
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

	const planNames: Record<string, string> = {
		basico: "Básico",
		mediano: "Mediano",
		profissional: "Profissional",
	};

	function planDirection(planId: string): "upgrade" | "downgrade" | "none" {
		const currentPlan = subscriptionData?.subscription?.plan;
		if (!currentPlan) return "upgrade";
		const planOrder = ["basico", "mediano", "profissional"];
		const currentIdx = planOrder.indexOf(currentPlan);
		const targetIdx = planOrder.indexOf(planId);
		if (targetIdx > currentIdx) return "upgrade";
		if (targetIdx < currentIdx) return "downgrade";
		return "none";
	}

	function isScheduledPlan(planId: string): boolean {
		return scheduledPlan?.id === planId;
	}
</script>

<div class="space-y-6">
	<div>
		<h3 class="mb-1 text-lg font-semibold">Planos e assinatura</h3>
		<p class="text-sm text-muted-foreground">
			Escolha o plano ideal para sua necessidade
		</p>
	</div>

	{#if expired}
		<div class="border border-amber-500/30 bg-amber-500/10 p-4">
			<p class="text-sm text-amber-600">Sessão de checkout expirada. Tente novamente.</p>
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
		<div class="grid gap-4 md:grid-cols-3">
			{#each plans as plan}
				<div class="relative flex flex-col border bg-card p-6 transition-all hover:border-primary/30
					{plan.highlight ? 'border-2 border-primary' : 'border-border'}
					{isCurrentPlan(plan.id) ? 'ring-2 ring-green-500' : ''}
					{isScheduledPlan(plan.id) ? 'ring-2 ring-amber-500' : ''}">
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
						<h4 class="font-serif text-xl font-semibold">{plan.name}</h4>
						<p class="text-sm text-muted-foreground">{plan.description}</p>
					</div>

					<div class="mb-4">
						<span class="text-3xl font-bold">R$ {plan.price}</span>
						<span class="text-muted-foreground">/mes</span>
					</div>

					{#if plan.id === "basico"}
						<div class="mb-4 flex items-center gap-2 border border-green-500/30 bg-green-500/10 p-2.5">
							<svg class="h-4 w-4 shrink-0 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span class="text-sm font-semibold text-green-600">1 semana grátis para testar</span>
						</div>
					{/if}

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
							<Badge class="w-full justify-center bg-green-500/10 py-2 text-green-600 hover:bg-green-500/10">
								Plano ativo
							</Badge>
							{#if scheduledPlan}
								<p class="text-center text-xs text-muted-foreground">
									Muda para {planNames[scheduledPlan.id] ?? scheduledPlan.id} em {formatDate(scheduledPlan.startsAt)}
								</p>
							{:else if subscriptionData?.subscription?.periodEnd}
								<p class="text-center text-xs text-muted-foreground">
									Renova em {formatDate(subscriptionData.subscription.periodEnd)}
								</p>
							{/if}
						</div>
					{:else if isScheduledPlan(plan.id)}
						<div class="space-y-2">
							<Badge class="w-full justify-center bg-amber-500/10 py-2 text-amber-600 hover:bg-amber-500/10">
								Agendado
							</Badge>
							{#if scheduledPlan?.startsAt}
								<p class="text-center text-xs text-muted-foreground">
									Começa em {formatDate(scheduledPlan.startsAt)}
								</p>
							{/if}
						</div>
					{:else}
						{@const direction = planDirection(plan.id)}
						<Button
							class="w-full"
							variant={direction === "upgrade" && plan.highlight ? "default" : "outline"}
							onclick={() => onUpgrade(plan.id)}
							disabled={isUpgrading !== null}
						>
							{#if isUpgrading === plan.id}
								<svg class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
								</svg>
								Processando...
							{:else if direction === "downgrade"}
								Mudar para {plan.name}
							{:else}
								Assinar {plan.name}
							{/if}
						</Button>
					{/if}
				</div>
			{/each}
		</div>

		{#if subscriptionData?.subscription?.plan}
			<div class="space-y-4 border border-border bg-card p-6">
				<div class="flex items-center justify-between">
					<div>
						<h4 class="font-medium">Gerenciar assinatura</h4>
						<p class="text-sm text-muted-foreground">
							Alterar método de pagamento, cancelar ou ver faturas
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
							Gerenciar cobrança
						{/if}
					</Button>
				</div>
			</div>
		{/if}
	{/if}
</div>
