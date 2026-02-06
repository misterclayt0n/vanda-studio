<script lang="ts">
	import { Button, Badge } from "$lib/components/ui";
	import { useConvexClient, useQuery } from "convex-svelte";
	import { api } from "../../../convex/_generated/api.js";
	import { ExternalLink, Check, X, RefreshCw } from "lucide-svelte";
	import { env } from "$env/dynamic/public";

	const client = useConvexClient();

	// Query connection status
	const connectionQuery = useQuery(api.googleCalendar.getConnectionStatus, () => ({}));
	let connectionStatus = $derived(connectionQuery.data ?? { connected: false });
	let isLoading = $derived(connectionQuery.isLoading);

	// Disconnect state
	let isDisconnecting = $state(false);

	// Get Google OAuth URL
	const GOOGLE_CLIENT_ID = env.PUBLIC_GOOGLE_CLIENT_ID ?? '';
	const REDIRECT_URI = typeof window !== 'undefined' 
		? `${window.location.origin}/api/auth/google/callback`
		: '';
	
	const GOOGLE_AUTH_URL = GOOGLE_CLIENT_ID 
		? `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
			client_id: GOOGLE_CLIENT_ID,
			redirect_uri: REDIRECT_URI,
			response_type: 'code',
			scope: 'https://www.googleapis.com/auth/calendar.events',
			access_type: 'offline',
			prompt: 'consent',
		}).toString()
		: '';

	// Handle connect
	function handleConnect() {
		if (GOOGLE_AUTH_URL) {
			window.location.href = GOOGLE_AUTH_URL;
		} else {
			alert('Google Calendar integration is not configured yet. Please set up your Google Cloud Console credentials.');
		}
	}

	// Handle disconnect
	async function handleDisconnect() {
		isDisconnecting = true;
		try {
			await client.mutation(api.googleCalendar.disconnect, {});
		} catch (err) {
			console.error('Failed to disconnect:', err);
		} finally {
			isDisconnecting = false;
		}
	}

	// Handle toggle sync
	async function handleToggleSync() {
		if (!connectionStatus.connected) return;
		
		try {
			await client.mutation(api.googleCalendar.toggleSync, {
				enabled: !connectionStatus.syncEnabled,
			});
		} catch (err) {
			console.error('Failed to toggle sync:', err);
		}
	}
</script>

<div class="rounded-none border border-border bg-card p-4">
	<div class="flex items-start gap-4">
		<!-- Google Calendar Icon -->
		<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-none border border-border bg-background">
			<svg class="h-6 w-6" viewBox="0 0 24 24" fill="none">
				<rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
				<path d="M3 9H21" stroke="currentColor" stroke-width="1.5"/>
				<path d="M9 4V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
				<path d="M15 4V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
				<circle cx="8" cy="14" r="1.5" fill="currentColor"/>
				<circle cx="12" cy="14" r="1.5" fill="currentColor"/>
				<circle cx="16" cy="14" r="1.5" fill="currentColor"/>
				<circle cx="8" cy="18" r="1.5" fill="currentColor"/>
				<circle cx="12" cy="18" r="1.5" fill="currentColor"/>
			</svg>
		</div>

		<!-- Content -->
		<div class="flex-1">
			<div class="flex items-center justify-between">
				<div>
					<h3 class="font-medium">Google Calendar</h3>
					<p class="text-sm text-muted-foreground">
						Sincronize seus posts agendados com o Google Calendar
					</p>
				</div>
				
				{#if isLoading}
					<Badge variant="outline">Carregando...</Badge>
				{:else if connectionStatus.connected}
					<Badge variant="secondary" class="bg-green-500/10 text-green-600">
						<Check class="mr-1 h-3 w-3" />
						Conectado
					</Badge>
				{:else}
					<Badge variant="outline">
						Desconectado
					</Badge>
				{/if}
			</div>

			{#if connectionStatus.connected}
				<div class="mt-4 space-y-3">
					<!-- Sync Toggle -->
					<div class="flex items-center justify-between">
						<span class="text-sm">Sincronização automática</span>
						<button
							type="button"
							role="switch"
							aria-checked={connectionStatus.syncEnabled}
							class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {connectionStatus.syncEnabled ? 'bg-primary' : 'bg-muted'}"
							onclick={handleToggleSync}
						>
							<span
								class="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform {connectionStatus.syncEnabled ? 'translate-x-4' : 'translate-x-0'}"
							></span>
						</button>
					</div>

					<!-- Token Status -->
					{#if connectionStatus.isExpired}
						<div class="flex items-center gap-2 text-sm text-amber-600">
							<RefreshCw class="h-4 w-4" />
							<span>Token expirado - reconecte para continuar sincronizando</span>
						</div>
					{/if}

					<!-- Actions -->
					<div class="flex gap-2">
						<Button variant="outline" size="sm" onclick={handleConnect}>
							<RefreshCw class="h-4 w-4" />
							Reconectar
						</Button>
						<Button 
							variant="ghost" 
							size="sm" 
							class="text-destructive hover:text-destructive"
							onclick={handleDisconnect}
							disabled={isDisconnecting}
						>
							{#if isDisconnecting}
								<svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
							{:else}
								<X class="h-4 w-4" />
							{/if}
							Desconectar
						</Button>
					</div>
				</div>
			{:else}
				<div class="mt-4">
					<Button onclick={handleConnect}>
						<ExternalLink class="h-4 w-4" />
						Conectar Google Calendar
					</Button>
					<p class="mt-2 text-xs text-muted-foreground">
						Ao conectar, você autoriza o Vanda Studio a criar eventos no seu calendário.
					</p>
				</div>
			{/if}
		</div>
	</div>
</div>
