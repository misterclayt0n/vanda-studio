<script lang="ts">
	import { Button, Separator } from "$lib/components/ui";
	import { SignedIn, SignedOut, SignInButton, UserButton } from "svelte-clerk";
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import Logo from "./Logo.svelte";
	import SettingsMenu from "./SettingsMenu.svelte";

	// Determine current route for active state
	let currentPath = $derived($page.url.pathname);

	// Navigation items
	const navItems = [
		{ href: "/posts/create", label: "Criar", icon: "sparkles" },
		{ href: "/calendar", label: "Calendario", icon: "calendar" },
		{ href: "/gallery", label: "Galeria", icon: "gallery" },
		{ href: "/projects", label: "Projetos", icon: "projects" },
	];

	function isActive(href: string): boolean {
		if (href === "/") return currentPath === "/";
		return currentPath.startsWith(href);
	}
</script>

<header class="shrink-0 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
	<div class="flex h-14 items-center justify-between px-4">
		<div class="flex items-center gap-4">
			<a href="/app" class="transition-opacity hover:opacity-80">
				<Logo />
			</a>

			<Separator orientation="vertical" class="h-6" />

			<!-- Navigation links -->
			<nav class="flex items-center gap-1">
				{#each navItems as item}
					<Button
						variant={isActive(item.href) ? "secondary" : "ghost"}
						size="sm"
						onclick={() => goto(item.href)}
						class="gap-2 transition-all {isActive(item.href) ? 'shadow-sm' : ''}"
					>
						{#if item.icon === "sparkles"}
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
							</svg>
						{:else if item.icon === "calendar"}
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
							</svg>
						{:else if item.icon === "gallery"}
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
							</svg>
						{:else if item.icon === "projects"}
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
							</svg>
						{/if}
						{item.label}
					</Button>
				{/each}
			</nav>
		</div>

		<div class="flex items-center gap-4">
			<SettingsMenu />
			<SignedOut>
				<SignInButton mode="modal">
					<button class="btn-glow h-8 rounded-none border border-border bg-background px-3 text-xs font-medium hover:bg-muted hover:border-primary/50 transition-all">
						Entrar
					</button>
				</SignInButton>
			</SignedOut>
			<SignedIn>
				<UserButton />
			</SignedIn>
		</div>
	</div>
</header>
