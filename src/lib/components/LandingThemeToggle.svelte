<script lang="ts">
	import { mode, setMode } from "mode-watcher";
	import { Sun, Monitor, Moon } from "lucide-svelte";

	const options = [
		{ value: "light" as const, icon: Sun, label: "Tema claro" },
		{ value: "system" as const, icon: Monitor, label: "Seguir o sistema" },
		{ value: "dark" as const, icon: Moon, label: "Tema escuro" },
	] as const;
</script>

<div
	class="flex items-center rounded-none border border-border bg-muted p-0.5"
	role="group"
	aria-label="Aparência: claro, sistema ou escuro"
>
	{#each options as option}
		<button
			type="button"
			onclick={() => setMode(option.value)}
			class="flex h-8 w-8 shrink-0 items-center justify-center rounded-none transition-colors {$mode === option.value
				? 'bg-background text-foreground shadow-sm'
				: 'text-muted-foreground hover:text-foreground'}"
			aria-label={option.label}
			aria-pressed={$mode === option.value}
		>
			<option.icon class="h-4 w-4" stroke-width="1.75" />
		</button>
	{/each}
</div>
