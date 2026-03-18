<script lang="ts">
	import { useConvexClient } from "convex-svelte";
	import { useClerkContext } from "svelte-clerk";
	import type { Snippet } from "svelte";
	import { api } from "../../convex/_generated/api.js";

	const { children }: { children: Snippet } = $props();

	const client = useConvexClient();
	const clerk = useClerkContext();
	let syncedUserId = $state<string | null>(null);

	// Set up auth token fetcher when clerk is ready
	$effect(() => {
		if (!clerk.session) {
			syncedUserId = null;
		}

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

	$effect(() => {
		const userId = clerk.user?.id ?? null;
		if (!clerk.session || !userId || syncedUserId === userId) {
			return;
		}

		const email =
			clerk.user?.primaryEmailAddress?.emailAddress ??
			clerk.user?.emailAddresses?.[0]?.emailAddress ??
			"";
		const name =
			clerk.user?.fullName ??
			clerk.user?.firstName ??
			email.split("@")[0] ??
			"Usuário";

		void client
			.mutation(api.users.store, {
				name,
				email,
				...(clerk.user?.imageUrl ? { imageUrl: clerk.user.imageUrl } : {}),
			})
			.then(() => {
				syncedUserId = userId;
			})
			.catch((error) => {
				console.error("Failed to sync Clerk user to Convex:", error);
			});
	});
</script>

{@render children()}
