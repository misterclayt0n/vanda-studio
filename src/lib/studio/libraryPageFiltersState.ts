import { browser } from "$app/environment";

export type LibraryGalleryAssetFilter = "all" | "media" | "posts";
export type LibraryPostPlatformFilter = "all" | "instagram" | "twitter" | "linkedin";
export type LibraryPostSchedulingFilter = "all" | "draft" | "scheduled";
export type LibraryMediaLinkFilter = "all" | "linked" | "unlinked";

export type LibraryGalleryFiltersState = {
	galleryAssetFilter: LibraryGalleryAssetFilter;
	postPlatformFilter: LibraryPostPlatformFilter;
	postSchedulingFilter: LibraryPostSchedulingFilter;
	mediaLinkFilter: LibraryMediaLinkFilter;
	gallerySearch: string;
};

const STORAGE_KEY = "vanda:library-gallery-filters:v2";

function parseState(raw: unknown): LibraryGalleryFiltersState | null {
	if (!raw || typeof raw !== "object") return null;
	const o = raw as Record<string, unknown>;
	const galleryAssetFilter = o.galleryAssetFilter;
	const postPlatformFilter = o.postPlatformFilter;
	const postSchedulingFilter = o.postSchedulingFilter;
	const mediaLinkFilter = o.mediaLinkFilter ?? "all";
	const gallerySearch = o.gallerySearch;

	if (
		galleryAssetFilter !== "all" &&
		galleryAssetFilter !== "media" &&
		galleryAssetFilter !== "posts"
	) {
		return null;
	}
	if (
		postPlatformFilter !== "all" &&
		postPlatformFilter !== "instagram" &&
		postPlatformFilter !== "twitter" &&
		postPlatformFilter !== "linkedin"
	) {
		return null;
	}
	if (
		postSchedulingFilter !== "all" &&
		postSchedulingFilter !== "draft" &&
		postSchedulingFilter !== "scheduled"
	) {
		return null;
	}
	if (
		mediaLinkFilter !== "all" &&
		mediaLinkFilter !== "linked" &&
		mediaLinkFilter !== "unlinked"
	) {
		return null;
	}
	if (typeof gallerySearch !== "string") return null;

	return {
		galleryAssetFilter,
		postPlatformFilter,
		postSchedulingFilter,
		mediaLinkFilter,
		gallerySearch,
	};
}

export function loadLibraryGalleryFiltersState(): LibraryGalleryFiltersState | null {
	if (!browser) return null;
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		return parseState(JSON.parse(raw) as unknown);
	} catch {
		return null;
	}
}

export function saveLibraryGalleryFiltersState(state: LibraryGalleryFiltersState) {
	if (!browser) return;
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// ignore quota errors
	}
}
