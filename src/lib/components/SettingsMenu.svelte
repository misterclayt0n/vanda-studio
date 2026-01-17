<script lang="ts">
	import { Popover, PopoverTrigger, PopoverContent } from "$lib/components/ui";
	import { mode, setMode } from "mode-watcher";
	import { Settings, Sun, Monitor, Moon } from "lucide-svelte";

	const themeOptions = [
		{ value: "light", icon: Sun, label: "Light" },
		{ value: "system", icon: Monitor, label: "System" },
		{ value: "dark", icon: Moon, label: "Dark" },
	] as const;
</script>

<Popover>
	<PopoverTrigger>
		<button
			class="flex h-8 w-8 items-center justify-center rounded-none border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
			aria-label="Settings"
		>
			<Settings class="h-4 w-4" />
		</button>
	</PopoverTrigger>
	<PopoverContent class="w-48" align="end">
		<div class="space-y-3">
			<p class="text-sm font-medium">Theme</p>
			<div class="flex items-center gap-1 rounded-none border border-border bg-muted p-1">
				{#each themeOptions as option}
					<button
						onclick={() => setMode(option.value)}
						class="flex flex-1 items-center justify-center rounded-none p-1.5 transition-colors {$mode === option.value
							? 'bg-background text-foreground shadow-sm'
							: 'text-muted-foreground hover:text-foreground'}"
						aria-label={option.label}
					>
						<option.icon class="h-4 w-4" />
					</button>
				{/each}
			</div>
		</div>
	</PopoverContent>
</Popover>
