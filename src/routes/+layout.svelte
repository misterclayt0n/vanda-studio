<script lang="ts">
	import "../app.css";
	import { env } from "$env/dynamic/public";
	import { ClerkProvider } from "svelte-clerk";
	import { setupConvex } from "convex-svelte";
	import { ModeWatcher } from "mode-watcher";
	import { Toaster } from "svelte-sonner";
	import ConvexClerkProvider from "$lib/components/convex-clerk-provider.svelte";
	import type { Appearance } from "@clerk/types";

	const { children } = $props();

	// Set up Convex first (without auth)
	const convexUrl = env.PUBLIC_CONVEX_URL;
	if (convexUrl) {
		setupConvex(convexUrl);
	}

	const clerkAppearance: Appearance = {
		variables: {
			borderRadius: "0px",
			fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
			colorBackground: "var(--popover)",
			colorText: "var(--foreground)",
			colorTextSecondary: "var(--muted-foreground)",
			colorPrimary: "var(--primary)",
			colorInputBackground: "var(--input)",
			colorInputText: "var(--foreground)",
			colorNeutral: "var(--foreground)",
		},
		elements: {
			card: "bg-popover shadow-md border border-border",
			userButtonPopoverCard: "bg-popover border border-border",
			userButtonPopoverMain: "bg-popover",
			userButtonPopoverActions: "bg-popover",
			userButtonPopoverActionButton: "text-foreground hover:bg-muted",
			userButtonPopoverActionButtonText: "text-foreground",
			userButtonPopoverActionButtonIcon: "text-muted-foreground",
			userButtonPopoverFooter: "hidden",
			userPreviewMainIdentifier: "text-foreground",
			userPreviewSecondaryIdentifier: "text-muted-foreground",
		},
	};
</script>

<ModeWatcher defaultMode="light" />
<Toaster position="bottom-right" />

<ClerkProvider appearance={clerkAppearance}>
	<div class="ambient-glow ambient-noise min-h-screen">
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
	</div>
</ClerkProvider>
