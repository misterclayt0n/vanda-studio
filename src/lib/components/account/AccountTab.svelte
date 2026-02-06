<script lang="ts">
	import { Button, Badge, Separator } from "$lib/components/ui";
	import { goto } from "$app/navigation";

	interface Props {
		user: any;
		clerkInstance: any;
	}

	let { user, clerkInstance }: Props = $props();

	let isSigningOut = $state(false);

	async function handleSignOut() {
		isSigningOut = true;
		try {
			await clerkInstance?.signOut();
			goto("/");
		} catch {
			isSigningOut = false;
		}
	}

	function handleManageAccount() {
		clerkInstance?.openUserProfile();
	}

	function formatMemberSince(date: Date | string | undefined): string {
		if (!date) return "";
		return new Date(date).toLocaleDateString("pt-BR", {
			day: "numeric",
			month: "long",
			year: "numeric",
		});
	}
</script>

<div class="space-y-8">
	<!-- Profile information -->
	<section>
		<h3 class="text-lg font-semibold mb-1">Informacoes do perfil</h3>
		<p class="text-sm text-muted-foreground mb-4">
			Seus dados de conta gerenciados pelo Clerk
		</p>

		<div class="border border-border bg-card">
			<div class="grid grid-cols-[140px_1fr] items-start gap-4 p-4 border-b border-border">
				<span class="text-sm text-muted-foreground">Nome</span>
				<span class="text-sm font-medium">{user?.fullName ?? "—"}</span>
			</div>
			<div class="grid grid-cols-[140px_1fr] items-start gap-4 p-4 border-b border-border">
				<span class="text-sm text-muted-foreground">Email</span>
				<span class="text-sm font-medium">{user?.primaryEmailAddress?.emailAddress ?? "—"}</span>
			</div>
			<div class="grid grid-cols-[140px_1fr] items-start gap-4 p-4 border-b border-border">
				<span class="text-sm text-muted-foreground">Membro desde</span>
				<span class="text-sm font-medium">{formatMemberSince(user?.createdAt)}</span>
			</div>
			<div class="p-4">
				<Button variant="outline" size="sm" onclick={handleManageAccount}>
					<svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
					Gerenciar conta
				</Button>
			</div>
		</div>
	</section>

	<!-- Connected accounts -->
	<section>
		<h3 class="text-lg font-semibold mb-1">Contas conectadas</h3>
		<p class="text-sm text-muted-foreground mb-4">
			Provedores de login vinculados a sua conta
		</p>

		<div class="border border-border bg-card">
			{#if user?.externalAccounts && user.externalAccounts.length > 0}
				{#each user.externalAccounts as account, i}
					<div class="flex items-center justify-between p-4 {i < user.externalAccounts.length - 1 ? 'border-b border-border' : ''}">
						<div class="flex items-center gap-3">
							<div class="flex h-8 w-8 items-center justify-center border border-border bg-muted">
								{#if account.provider === "google"}
									<svg class="h-4 w-4" viewBox="0 0 24 24">
										<path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
										<path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
										<path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
										<path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
									</svg>
								{:else}
									<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
									</svg>
								{/if}
							</div>
							<div>
								<p class="text-sm font-medium capitalize">{account.provider ?? "Provedor"}</p>
								<p class="text-xs text-muted-foreground">{account.emailAddress ?? ""}</p>
							</div>
						</div>
						<Badge variant="outline" class="text-xs">Conectado</Badge>
					</div>
				{/each}
			{:else}
				<div class="p-4 text-center">
					<p class="text-sm text-muted-foreground">Nenhuma conta externa conectada</p>
				</div>
			{/if}
		</div>
	</section>

	<!-- Danger zone -->
	<section>
		<Separator class="mb-6" />
		<h3 class="text-lg font-semibold mb-1 text-destructive">Zona de perigo</h3>
		<p class="text-sm text-muted-foreground mb-4">
			Acoes irreversiveis da conta
		</p>

		<div class="flex flex-wrap gap-3">
			<Button
				variant="outline"
				onclick={handleSignOut}
				disabled={isSigningOut}
				class="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
			>
				{#if isSigningOut}
					<svg class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
					</svg>
					Saindo...
				{:else}
					<svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
					</svg>
					Sair da conta
				{/if}
			</Button>
		</div>
	</section>
</div>
