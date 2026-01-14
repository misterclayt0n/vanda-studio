<script lang="ts">
	import "../app.css";
	import { env } from "$env/dynamic/public";
	import { ClerkProvider } from "svelte-clerk";
	import { setupConvex } from "convex-svelte";
	import { ModeWatcher } from "mode-watcher";
	import { Toaster } from "svelte-sonner";
	import ConvexClerkProvider from "$lib/components/convex-clerk-provider.svelte";

	const { children } = $props();

	// Set up Convex first (without auth)
	const convexUrl = env.PUBLIC_CONVEX_URL;
	if (convexUrl) {
		setupConvex(convexUrl);
	}
</script>

<ModeWatcher defaultMode="light" />
<Toaster position="bottom-right" />

<ClerkProvider>
	{#if env.PUBLIC_CONVEX_URL}
		<ConvexClerkProvider>
			{@render children()}
		</ConvexClerkProvider>
	{:else}
		<div class="flex min-h-screen items-center justify-center">
			<div class="text-center">
				<h1 class="text-xl font-semibold text-destructive">Missing Configuration</h1>
				<p class="mt-2 text-sm text-muted-foreground">
					PUBLIC_CONVEX_URL environment variable is not set.
				</p>
			</div>
		</div>
	{/if}
</ClerkProvider>
