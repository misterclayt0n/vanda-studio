<script lang="ts">
	import { Badge } from "$lib/components/ui";

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
		user: any;
		subscriptionData: SubscriptionData | null;
		isLoading: boolean;
	}

	let { user, subscriptionData, isLoading }: Props = $props();

	function getPlanLabel(planId: string): string {
		const labels: Record<string, string> = {
			basico: "Básico",
			mediano: "Mediano",
			profissional: "Profissional",
		};
		return labels[planId] || planId;
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString("pt-BR", {
			day: "numeric",
			month: "short",
		});
	}

	let usagePercent = $derived(
		subscriptionData?.subscription
			? Math.min(
					100,
					(subscriptionData.subscription.promptsUsed /
						subscriptionData.subscription.promptsLimit) *
						100
				)
			: 0
	);

	let remaining = $derived(
		subscriptionData?.subscription
			? subscriptionData.subscription.promptsLimit -
					subscriptionData.subscription.promptsUsed
			: 0
	);
</script>

<aside class="hidden lg:flex w-80 shrink-0 flex-col border-r border-border bg-card/30 p-6 overflow-y-auto">
	<!-- Profile section -->
	<div class="flex flex-col items-center text-center">
		<!-- Avatar with brutalist border -->
		<div class="relative mb-4 group">
			<div class="absolute -inset-1 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
			<div class="relative h-24 w-24 border-2 border-border overflow-hidden bg-muted">
				{#if user?.imageUrl}
					<img
						src={user.imageUrl}
						alt={user.fullName ?? "Avatar"}
						class="h-full w-full object-cover"
					/>
				{:else}
					<div class="flex h-full w-full items-center justify-center bg-primary/10 text-primary text-2xl font-bold font-serif">
						{user?.firstName?.[0] ?? "?"}
					</div>
				{/if}
			</div>
		</div>

		<!-- Name -->
		<h2 class="text-xl font-bold font-serif tracking-tight">
			{user?.fullName ?? "Carregando..."}
		</h2>

		<!-- Email -->
		<p class="mt-1 text-sm text-muted-foreground truncate max-w-full">
			{user?.primaryEmailAddress?.emailAddress ?? ""}
		</p>

		<!-- Plan badge -->
		<div class="mt-3">
			{#if subscriptionData?.subscription?.plan}
				<Badge variant="default" class="text-xs">
					{getPlanLabel(subscriptionData.subscription.plan)}
				</Badge>
			{:else if isLoading}
				<div class="h-5 w-20 bg-muted animate-pulse"></div>
			{:else}
				<Badge variant="outline" class="text-xs">Sem plano</Badge>
			{/if}
		</div>
	</div>

	<!-- Separator -->
	<div class="my-6 h-px bg-border"></div>

	<!-- Usage meter -->
	{#if isLoading}
		<div class="space-y-3">
			<div class="h-4 w-32 bg-muted animate-pulse"></div>
			<div class="h-2 w-full bg-muted animate-pulse"></div>
			<div class="h-3 w-24 bg-muted animate-pulse"></div>
		</div>
	{:else if subscriptionData?.subscription?.plan}
		<div class="space-y-3">
			<div class="flex items-baseline justify-between">
				<span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Uso</span>
				<span class="text-xs text-muted-foreground">
					{subscriptionData.subscription.promptsUsed}/{subscriptionData.subscription.promptsLimit}
				</span>
			</div>

			<!-- Progress bar -->
			<div class="relative h-1.5 w-full bg-muted overflow-hidden">
				<div
					class="absolute inset-y-0 left-0 bg-primary transition-all duration-500 ease-out"
					style="width: {usagePercent}%"
				></div>
			</div>

			<div class="flex items-center justify-between">
				<p class="text-xs text-muted-foreground">
					{remaining} imagens restantes
				</p>
				{#if subscriptionData.subscription.resetAt}
					<p class="text-xs text-muted-foreground">
						Reseta {formatDate(subscriptionData.subscription.resetAt)}
					</p>
				{/if}
			</div>
		</div>
	{:else}
		<div class="border border-dashed border-border p-4 text-center">
			<p class="text-xs text-muted-foreground">
				Assine um plano para começar a criar
			</p>
		</div>
	{/if}

	<!-- Separator -->
	<div class="my-6 h-px bg-border"></div>

	<!-- Keyboard shortcuts -->
	<div class="space-y-3">
		<span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Atalhos</span>
		<div class="space-y-2">
			{#each [
				{ keys: ["⌘", "N"], label: "Nova imagem" },
				{ keys: ["⌘", "K"], label: "Buscar" },
				{ keys: ["⌘", "B"], label: "Barra lateral" },
			] as shortcut}
				<div class="flex items-center justify-between text-xs">
					<span class="text-muted-foreground">{shortcut.label}</span>
					<div class="flex gap-1">
						{#each shortcut.keys as key}
							<kbd class="inline-flex h-5 min-w-5 items-center justify-center border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
								{key}
							</kbd>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Spacer to push member-since to bottom -->
	<div class="flex-1"></div>

	<!-- Member since -->
	{#if user?.createdAt}
		<div class="mt-6 pt-4 border-t border-border">
			<p class="text-[10px] uppercase tracking-widest text-muted-foreground/60">
				Membro desde {new Date(user.createdAt).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
			</p>
		</div>
	{/if}
</aside>

<!-- Mobile profile bar -->
<div class="flex lg:hidden items-center gap-4 border-b border-border bg-card/30 px-4 py-3">
	<div class="h-10 w-10 shrink-0 border border-border overflow-hidden bg-muted">
		{#if user?.imageUrl}
			<img src={user.imageUrl} alt={user.fullName ?? "Avatar"} class="h-full w-full object-cover" />
		{:else}
			<div class="flex h-full w-full items-center justify-center bg-primary/10 text-primary text-sm font-bold">
				{user?.firstName?.[0] ?? "?"}
			</div>
		{/if}
	</div>
	<div class="min-w-0 flex-1">
		<p class="text-sm font-medium truncate">{user?.fullName ?? ""}</p>
		<p class="text-xs text-muted-foreground truncate">{user?.primaryEmailAddress?.emailAddress ?? ""}</p>
	</div>
	{#if subscriptionData?.subscription?.plan}
		<Badge variant="default" class="shrink-0 text-xs">
			{getPlanLabel(subscriptionData.subscription.plan)}
		</Badge>
	{/if}
</div>
