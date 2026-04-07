<script lang="ts">
	import { goto } from "$app/navigation";
	import { onMount } from "svelte";
	import { page } from "$app/stores";

	onMount(() => {
		const expired = $page.url.searchParams.get("expired");
		const target = expired === "true"
			? "/account?expired=true#planos"
			: "/account#planos";
		goto(target, { replaceState: true });
	});
</script>

<div class="flex h-screen items-center justify-center bg-background">
	<p class="text-sm text-muted-foreground">Redirecionando...</p>
</div>
