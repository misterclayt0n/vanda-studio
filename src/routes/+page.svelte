<script lang="ts">
	import { SignedIn, SignedOut, SignInButton, UserButton } from "svelte-clerk";
	import { useQuery } from "convex-svelte";
	import { api } from "../convex/_generated/api.js";

	// Test query - list user's projects (will be empty if not authenticated)
	const projects = useQuery(api.projects.list, {});
</script>

<svelte:head>
	<title>Vanda Studio</title>
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- Header -->
	<header class="border-b border-border">
		<div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
			<div class="flex items-center gap-2">
				<h1 class="text-lg font-semibold">Vanda Studio</h1>
				<span class="rounded-none bg-primary/10 px-2 py-0.5 text-xs text-primary">SvelteKit</span>
			</div>

			<div class="flex items-center gap-4">
				<SignedOut>
					<SignInButton mode="modal">
						<button
							class="h-8 rounded-none border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
						>
							Sign In
						</button>
					</SignInButton>
				</SignedOut>

				<SignedIn>
					<UserButton />
				</SignedIn>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="mx-auto max-w-7xl px-4 py-8">
		<SignedOut>
			<div class="flex flex-col items-center justify-center gap-6 py-20">
				<div class="text-center">
					<h2 class="text-2xl font-bold">Welcome to Vanda Studio</h2>
					<p class="mt-2 text-muted-foreground">
						Instagram post generation powered by AI
					</p>
				</div>

				<SignInButton mode="modal">
					<button
						class="h-9 rounded-none bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
					>
						Get Started
					</button>
				</SignInButton>
			</div>
		</SignedOut>

		<SignedIn>
			<div class="space-y-6">
				<div>
					<h2 class="text-xl font-semibold">Your Projects</h2>
					<p class="text-sm text-muted-foreground">
						Convex + Clerk integration is working!
					</p>
				</div>

				<!-- Projects from Convex -->
				<div class="rounded-none border border-border bg-card p-4">
					{#if projects.isLoading}
						<p class="text-sm text-muted-foreground">Loading projects...</p>
					{:else if projects.error}
						<p class="text-sm text-destructive">
							Error: {projects.error.message}
						</p>
					{:else if projects.data && projects.data.length > 0}
						<ul class="space-y-2">
							{#each projects.data as project}
								<li class="flex items-center justify-between rounded-none border border-border p-3">
									<div>
										<p class="font-medium">{project.name}</p>
										<p class="text-xs text-muted-foreground">
											{project.instagramUrl || "No Instagram URL"}
										</p>
									</div>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="text-sm text-muted-foreground">
							No projects yet. Create one to get started!
						</p>
					{/if}
				</div>

				<!-- Debug Info -->
				<div class="rounded-none border border-border bg-muted/30 p-4">
					<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
						Debug Info
					</p>
					<ul class="mt-2 space-y-1 text-xs text-muted-foreground">
						<li>Framework: SvelteKit</li>
						<li>Auth: Clerk (svelte-clerk)</li>
						<li>Database: Convex (convex-svelte)</li>
						<li>Styling: Tailwind CSS v4</li>
					</ul>
				</div>
			</div>
		</SignedIn>
	</main>
</div>
