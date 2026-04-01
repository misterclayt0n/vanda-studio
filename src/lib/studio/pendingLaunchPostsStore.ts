import { writable } from "svelte/store";

/** Project IDs with an in-flight launch-posts action (ideas phase or awaiting Convex). Survives client-side navigations. */
function createPendingLaunchPostsStore() {
	const { subscribe, update } = writable<ReadonlySet<string>>(new Set());

	return {
		subscribe,
		add(projectId: string) {
			update((s) => new Set(s).add(projectId));
		},
		delete(projectId: string) {
			update((s) => {
				if (!s.has(projectId)) return s;
				const next = new Set(s);
				next.delete(projectId);
				return next;
			});
		},
	};
}

export const pendingLaunchPosts = createPendingLaunchPostsStore();

