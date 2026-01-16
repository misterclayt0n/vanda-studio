<script lang="ts">
	import { SignedIn, SignedOut, SignInButton } from "svelte-clerk";
	import { useQuery } from "convex-svelte";
	import { api } from "../convex/_generated/api.js";
	import Navbar from "$lib/components/Navbar.svelte";

	// Test query - list user's projects (will be empty if not authenticated)
	const projects = useQuery(api.projects.list, {});
</script>

<svelte:head>
	<title>Vanda Studio</title>
</svelte:head>

<div class="flex h-screen flex-col bg-background">
	<Navbar />

	<!-- Main Content -->
	<main class="flex-1 overflow-y-auto px-4 py-8">
		<SignedOut>
			<div class="flex flex-col items-center justify-center gap-6 py-20">
				<div class="text-center">
					<h2 class="text-2xl font-bold">Bem-vindo ao Vanda Studio</h2>
					<p class="mt-2 text-muted-foreground">
						Geração de posts para Instagram com inteligência artificial
					</p>
				</div>

				<SignInButton mode="modal">
					<button
						class="h-9 rounded-none bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
					>
						Começar Agora
					</button>
				</SignInButton>
			</div>
		</SignedOut>

		<SignedIn>
			<div class="space-y-6">
				<div>
					<h2 class="text-xl font-semibold">Seus Projetos</h2>
					<p class="text-sm text-muted-foreground">
						Integração Convex + Clerk funcionando!
					</p>
				</div>

				<!-- Projects from Convex -->
				<div class="rounded-none border border-border bg-card p-4">
					{#if projects.isLoading}
						<p class="text-sm text-muted-foreground">Carregando projetos...</p>
					{:else if projects.error}
						<p class="text-sm text-destructive">
							Erro: {projects.error.message}
						</p>
					{:else if projects.data && projects.data.length > 0}
						<ul class="space-y-2">
							{#each projects.data as project}
								<li class="flex items-center justify-between rounded-none border border-border p-3">
									<div>
										<p class="font-medium">{project.name}</p>
										<p class="text-xs text-muted-foreground">
											{project.instagramUrl || "Sem URL do Instagram"}
										</p>
									</div>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="text-sm text-muted-foreground">
							Nenhum projeto ainda. Crie um para começar!
						</p>
					{/if}
				</div>
				</div>
		</SignedIn>
	</main>
</div>

