import { browser } from "$app/environment";
export type PostsPageFilterStatus = "all" | "draft" | "scheduled";
export type PostsPagePlatform = "instagram" | "twitter" | "linkedin";

export type PostsPageState = {
	searchQuery: string;
	filterProjectId: string | null;
	filterStatus: PostsPageFilterStatus;
	platform: PostsPagePlatform;
	selectedPostId: string | null;
};

const STORAGE_KEY = "vanda:posts-page-state:v2";

let memoryState: PostsPageState | null = null;

export function loadPostsPageState(): PostsPageState | null {
	if (!browser) return null;

	if (memoryState) {
		return { ...memoryState };
	}

	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return null;

		const parsed = JSON.parse(raw) as Partial<PostsPageState>;
		const platform = parsed.platform ?? "instagram";
		const selectedPostId = parsed.selectedPostId ?? null;
		if (
			typeof parsed.searchQuery !== "string" ||
			(parsed.filterProjectId !== undefined &&
				parsed.filterProjectId !== null &&
				typeof parsed.filterProjectId !== "string") ||
			(platform !== "instagram" &&
				platform !== "twitter" &&
				platform !== "linkedin") ||
			(selectedPostId !== null && typeof selectedPostId !== "string") ||
			(parsed.filterStatus !== "all" &&
				parsed.filterStatus !== "draft" &&
				parsed.filterStatus !== "scheduled")
		) {
			return null;
		}

		return {
			searchQuery: parsed.searchQuery,
			filterProjectId: parsed.filterProjectId ?? null,
			filterStatus: parsed.filterStatus,
			platform,
			selectedPostId,
		};
	} catch (error) {
		console.error("Failed to load /posts page state:", error);
		return null;
	}
}

export function savePostsPageState(state: PostsPageState) {
	if (!browser) return;

	memoryState = { ...state };

	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch (error) {
		console.error("Failed to save /posts page state:", error);
	}
}
