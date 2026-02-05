<script lang="ts">
	import type { PageData } from "./$types";
	import AppHome from "$lib/pages/AppHome.svelte";
	import LandingPage from "$lib/pages/LandingPage.svelte";

	export let data: PageData;
</script>

{#if data.site === "app"}
	<AppHome />
{:else}
	<LandingPage />
{/if}
