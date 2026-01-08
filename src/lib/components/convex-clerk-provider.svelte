<script lang="ts">
	import { useConvexClient } from "convex-svelte";
	import { useClerkContext } from "svelte-clerk";
	import { onMount } from "svelte";
	import type { Snippet } from "svelte";

	const { children }: { children: Snippet } = $props();

	const client = useConvexClient();
	const clerk = useClerkContext();

	// Set up auth token fetcher when clerk is ready
	$effect(() => {
		if (clerk.session) {
			client.setAuth(
				async () => {
					try {
						const token = await clerk.session?.getToken({ template: "convex" });
						return token ?? null;
					} catch {
						return null;
					}
				},
				(isAuthenticated: boolean) => {
					console.log("Convex auth state changed:", isAuthenticated);
				}
			);
		}
	});
</script>

{@render children()}
