<script lang="ts">
	import { goto } from "$app/navigation";
	import { toggleMode } from "mode-watcher";
	import { tick } from "svelte";

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open, onclose }: Props = $props();

	let query = $state("");
	let selectedIndex = $state(0);
	let inputEl: HTMLInputElement;

	// ── Platform detection ────────────────────────────────────

	let isMac = $state(false);
	$effect(() => {
		isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
	});

	let mod = $derived(isMac ? "⌘" : "Ctrl");

	// ── Commands ──────────────────────────────────────────────

	type Command = {
		id: string;
		label: string;
		group: string;
		icon: string;
		shortcut?: string[];
		action: () => void;
	};

	let commands = $derived<Command[]>([
		{ id: "create-post", label: "Criar post", group: "Navegação", icon: "sparkles", shortcut: [mod, "⇧", "O"], action: () => goto("/posts/create") },
		{ id: "calendar", label: "Calendário", group: "Navegação", icon: "calendar", action: () => goto("/calendar") },
		{ id: "gallery", label: "Galeria", group: "Navegação", icon: "gallery", action: () => goto("/gallery") },
		{ id: "projects", label: "Projetos", group: "Navegação", icon: "projects", action: () => goto("/projects") },
		{ id: "settings", label: "Configurações", group: "Configurações", icon: "settings", action: () => goto("/account") },
		{ id: "toggle-theme", label: "Alternar tema", group: "Configurações", icon: "theme", action: () => toggleMode() },
	]);

	// ── Filtering ─────────────────────────────────────────────

	let filteredCommands = $derived(
		query.trim() === ""
			? commands
			: commands.filter(
					(cmd) =>
						cmd.label.toLowerCase().includes(query.toLowerCase()) ||
						cmd.group.toLowerCase().includes(query.toLowerCase())
				)
	);

	let groupedCommands = $derived.by(() => {
		const groups: [string, Command[]][] = [];
		const seen = new Map<string, Command[]>();
		for (const cmd of filteredCommands) {
			let arr = seen.get(cmd.group);
			if (!arr) {
				arr = [];
				seen.set(cmd.group, arr);
				groups.push([cmd.group, arr]);
			}
			arr.push(cmd);
		}
		return groups;
	});

	// ── Keyboard navigation ───────────────────────────────────

	$effect(() => {
		// Reset selection when query changes
		query;
		selectedIndex = 0;
	});

	$effect(() => {
		if (open) {
			document.body.style.overflow = "hidden";
			tick().then(() => inputEl?.focus());
		} else {
			document.body.style.overflow = "";
			query = "";
			selectedIndex = 0;
		}
		return () => {
			document.body.style.overflow = "";
		};
	});

	$effect(() => {
		if (open) {
			const el = document.querySelector(`[data-command-index="${selectedIndex}"]`);
			el?.scrollIntoView({ block: "nearest" });
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			e.preventDefault();
			e.stopImmediatePropagation();
			onclose();
			return;
		}

		if (e.key === "ArrowDown") {
			e.preventDefault();
			selectedIndex = filteredCommands.length > 0 ? (selectedIndex + 1) % filteredCommands.length : 0;
			return;
		}

		if (e.key === "ArrowUp") {
			e.preventDefault();
			selectedIndex =
				filteredCommands.length > 0
					? (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length
					: 0;
			return;
		}

		if (e.key === "Enter") {
			e.preventDefault();
			const cmd = filteredCommands[selectedIndex];
			if (cmd) executeCommand(cmd);
			return;
		}
	}

	function executeCommand(command: Command) {
		command.action();
		onclose();
	}

	function getFlatIndex(command: Command): number {
		return filteredCommands.indexOf(command);
	}
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
		onclick={onclose}
		onkeydown={undefined}
		role="button"
		tabindex="-1"
	></div>

	<!-- Palette -->
	<div class="fixed left-1/2 top-[35%] z-[60] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 border border-border bg-background shadow-2xl">
		<!-- Search input -->
		<div class="flex items-center gap-3 border-b border-border px-4 py-3">
			<svg class="h-4 w-4 shrink-0 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
			</svg>
			<input
				bind:this={inputEl}
				type="text"
				placeholder="Digite um comando..."
				class="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
				bind:value={query}
			/>
			<kbd class="inline-flex h-5 select-none items-center border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
				Esc
			</kbd>
		</div>

		<!-- Command list -->
		<div class="max-h-[300px] overflow-y-auto p-2">
			{#each groupedCommands as [groupName, groupCommands]}
				<div class="px-2 py-1.5">
					<span class="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
						{groupName}
					</span>
				</div>
				{#each groupCommands as command}
					{@const flatIndex = getFlatIndex(command)}
					<button
						type="button"
						data-command-index={flatIndex}
						class="flex w-full items-center gap-3 px-3 py-2.5 text-sm transition-colors
							{flatIndex === selectedIndex
								? 'bg-accent text-accent-foreground'
								: 'text-foreground hover:bg-muted'}"
						onclick={() => executeCommand(command)}
						onmouseenter={() => (selectedIndex = flatIndex)}
					>
						<!-- Icon -->
						<span class="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
							{#if command.icon === "sparkles"}
								<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
								</svg>
							{:else if command.icon === "calendar"}
								<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
								</svg>
							{:else if command.icon === "gallery"}
								<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
								</svg>
							{:else if command.icon === "projects"}
								<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
								</svg>
							{:else if command.icon === "settings"}
								<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
									<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
							{:else if command.icon === "theme"}
								<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
								</svg>
							{/if}
						</span>

						<span class="flex-1 text-left">{command.label}</span>

						{#if command.shortcut}
							<div class="ml-auto flex gap-1">
								{#each command.shortcut as key}
									<kbd class="inline-flex h-5 min-w-5 items-center justify-center border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
										{key}
									</kbd>
								{/each}
							</div>
						{/if}
					</button>
				{/each}
			{/each}

			{#if filteredCommands.length === 0}
				<div class="px-3 py-8 text-center text-sm text-muted-foreground">
					Nenhum comando encontrado
				</div>
			{/if}
		</div>

		<!-- Footer hint -->
		<div class="flex items-center gap-2 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
			<kbd class="inline-flex h-4 min-w-4 items-center justify-center border border-border bg-muted px-0.5 font-mono text-[9px]">↵</kbd>
			<span>para selecionar</span>
			<kbd class="ml-2 inline-flex h-4 min-w-4 items-center justify-center border border-border bg-muted px-0.5 font-mono text-[9px]">↑↓</kbd>
			<span>para navegar</span>
		</div>
	</div>
{/if}
