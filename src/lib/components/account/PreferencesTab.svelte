<script lang="ts">
	import { mode, setMode } from "mode-watcher";
	import { Badge } from "$lib/components/ui";
	import { Sun, Monitor, Moon } from "lucide-svelte";

	const themes = [
		{
			value: "light" as const,
			icon: Sun,
			label: "Claro",
			description: "Interface com fundo claro",
		},
		{
			value: "system" as const,
			icon: Monitor,
			label: "Sistema",
			description: "Segue o tema do dispositivo",
		},
		{
			value: "dark" as const,
			icon: Moon,
			label: "Escuro",
			description: "Interface com fundo escuro",
		},
	];
</script>

<div class="space-y-8">
	<!-- Appearance -->
	<section>
		<h3 class="text-lg font-semibold mb-1">Aparencia</h3>
		<p class="text-sm text-muted-foreground mb-4">
			Personalize como o Vanda Studio aparece para voce
		</p>

		<div class="grid gap-3 sm:grid-cols-3">
			{#each themes as theme}
				<button
					onclick={() => setMode(theme.value)}
					class="flex flex-col items-center gap-3 border p-5 text-center transition-all
						{$mode === theme.value
							? 'border-primary bg-primary/5 shadow-[0_0_0_1px] shadow-primary/20'
							: 'border-border bg-card hover:border-primary/30 hover:bg-muted/30'}"
				>
					<div class="flex h-10 w-10 items-center justify-center
						{$mode === theme.value ? 'text-primary' : 'text-muted-foreground'}">
						<theme.icon class="h-5 w-5" />
					</div>
					<div>
						<p class="text-sm font-medium">{theme.label}</p>
						<p class="mt-0.5 text-xs text-muted-foreground">{theme.description}</p>
					</div>
				</button>
			{/each}
		</div>
	</section>

	<!-- Language -->
	<section>
		<h3 class="text-lg font-semibold mb-1">Idioma</h3>
		<p class="text-sm text-muted-foreground mb-4">
			Escolha o idioma da interface
		</p>

		<div class="border border-border bg-card">
			<div class="flex items-center justify-between p-4">
				<div class="flex items-center gap-3">
					<div class="flex h-8 w-8 items-center justify-center border border-border bg-muted text-sm">
						🇧🇷
					</div>
					<div>
						<p class="text-sm font-medium">Portugues (Brasil)</p>
						<p class="text-xs text-muted-foreground">Idioma padrao</p>
					</div>
				</div>
				<Badge variant="outline" class="text-xs text-muted-foreground">Em breve</Badge>
			</div>
		</div>
	</section>

	<!-- Notifications -->
	<section>
		<h3 class="text-lg font-semibold mb-1">Notificacoes</h3>
		<p class="text-sm text-muted-foreground mb-4">
			Gerencie suas preferencias de notificacao
		</p>

		<div class="border border-border bg-card">
			{#each [
				{ label: "Novidades e atualizacoes", description: "Receba emails sobre novos recursos" },
				{ label: "Lembretes de cobranca", description: "Notificacoes sobre pagamentos e faturas" },
				{ label: "Dicas de uso", description: "Sugestoes para aproveitar melhor a plataforma" },
			] as notification, i}
				<div class="flex items-center justify-between p-4 {i < 2 ? 'border-b border-border' : ''}">
					<div>
						<p class="text-sm font-medium">{notification.label}</p>
						<p class="text-xs text-muted-foreground">{notification.description}</p>
					</div>
					<Badge variant="outline" class="text-xs text-muted-foreground shrink-0">Em breve</Badge>
				</div>
			{/each}
		</div>
	</section>
</div>
