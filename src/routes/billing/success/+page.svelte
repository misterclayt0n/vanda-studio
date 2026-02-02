<script lang="ts">
	import { Button } from "$lib/components/ui";
	import { goto } from "$app/navigation";
	import Navbar from "$lib/components/Navbar.svelte";
	import { onMount } from "svelte";

	let countdown = $state(5);

	onMount(() => {
		const interval = setInterval(() => {
			countdown -= 1;
			if (countdown <= 0) {
				clearInterval(interval);
				goto('/posts/create');
			}
		}, 1000);

		return () => clearInterval(interval);
	});
</script>

<svelte:head>
	<title>Pagamento Confirmado - Vanda Studio</title>
</svelte:head>

<div class="flex h-screen flex-col bg-background">
	<Navbar />

	<main class="flex flex-1 flex-col items-center justify-center px-4">
		<div class="text-center">
			<div class="mb-6 flex justify-center">
				<div class="rounded-full bg-green-500/10 p-4">
					<svg class="h-16 w-16 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
			</div>

			<h1 class="mb-2 text-2xl font-bold">Pagamento confirmado!</h1>
			<p class="mb-6 text-muted-foreground">
				Seu plano ja esta ativo. Aproveite suas novas imagens!
			</p>

			<div class="flex justify-center gap-4">
				<Button onclick={() => goto('/posts/create')}>
					<svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
					</svg>
					Comecar a criar
				</Button>
				<Button variant="outline" onclick={() => goto('/billing')}>
					Ver meu plano
				</Button>
			</div>

			<p class="mt-6 text-sm text-muted-foreground">
				Redirecionando automaticamente em {countdown} segundo{countdown !== 1 ? 's' : ''}...
			</p>
		</div>
	</main>
</div>
