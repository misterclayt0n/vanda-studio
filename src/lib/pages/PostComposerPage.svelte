<script lang="ts">
	import Navbar from "$lib/components/Navbar.svelte";
	import { PostComposerWorkspace } from "$lib/components/posts";
	import { SignedIn, SignedOut, SignInButton } from "svelte-clerk";
	import type { Id } from "../../convex/_generated/dataModel.js";

	interface Props {
		postId?: Id<"generated_posts"> | null;
	}

	let { postId = null }: Props = $props();
</script>

<div class="flex h-screen flex-col bg-background">
	<Navbar />

	<SignedOut>
		<div class="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-20">
			<div class="max-w-md text-center">
				<h2 class="text-2xl font-semibold">Entre para montar seus posts</h2>
				<p class="mt-2 text-sm text-muted-foreground">
					Selecione imagens da biblioteca, gere uma legenda e agende tudo do mesmo lugar.
				</p>
			</div>
			<SignInButton mode="modal">
				<button class="h-10 rounded-none bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
					Entrar
				</button>
			</SignInButton>
		</div>
	</SignedOut>

	<SignedIn>
		<PostComposerWorkspace {postId} />
	</SignedIn>
</div>
