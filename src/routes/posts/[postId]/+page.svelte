<script lang="ts">
	import PostComposerPage from "$lib/pages/PostComposerPage.svelte";
	import { page } from "$app/stores";
	import type { Id } from "../../../convex/_generated/dataModel.js";

	const postId = $derived($page.params.postId as Id<"generated_posts">);
</script>

<PostComposerPage {postId} />
