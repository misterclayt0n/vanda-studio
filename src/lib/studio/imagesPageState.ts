import { browser } from "$app/environment";
import type { AspectRatio, Resolution } from "$lib/studio/imageGenerationCapabilities";
import type { MediaSortOrder, MediaSourceFilter } from "$lib/studio/mediaBrowserFilters";

export type ImagesPageViewMode = "images" | "conversations";

export type ImagesPageReference = {
	storageId: string;
	previewUrl: string;
};

export type ImagesPageState = {
	prompt: string;
	selectedModels: string[];
	aspectRatio: AspectRatio;
	resolution: Resolution;
	selectedProjectId: string | null;
	manualReferences: ImagesPageReference[];
	filterProjectId: string | null;
	filterModel: string;
	filterSource: MediaSourceFilter;
	sortOrder: MediaSortOrder;
	viewMode: ImagesPageViewMode;
};

const STORAGE_KEY = "vanda:images-page-state:v2";

let memoryState: ImagesPageState | null = null;
type SessionState = Partial<ImagesPageState>;

export function loadImagesPageState(): ImagesPageState | null {
	if (!browser) return null;

	if (memoryState) {
		return {
			...memoryState,
			selectedModels: [...memoryState.selectedModels],
			manualReferences: memoryState.manualReferences.map((reference) => ({ ...reference })),
		};
	}

	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return null;

		const parsed = JSON.parse(raw) as SessionState;
		const filterSource = parsed.filterSource ?? "all";
		const sortOrder = parsed.sortOrder ?? "newest";
		const viewMode = parsed.viewMode ?? "images";

		if (
			typeof parsed.prompt !== "string" ||
			!Array.isArray(parsed.selectedModels) ||
			typeof parsed.aspectRatio !== "string" ||
			typeof parsed.resolution !== "string" ||
			(parsed.selectedProjectId !== null && typeof parsed.selectedProjectId !== "string") ||
			(parsed.filterProjectId !== undefined &&
				parsed.filterProjectId !== null &&
				typeof parsed.filterProjectId !== "string") ||
			(parsed.filterModel !== undefined && typeof parsed.filterModel !== "string") ||
			(filterSource !== "all" &&
				filterSource !== "edited" &&
				filterSource !== "generated_uploaded") ||
			(sortOrder !== "newest" && sortOrder !== "oldest") ||
			(viewMode !== "images" && viewMode !== "conversations") ||
			(parsed.manualReferences !== undefined && !Array.isArray(parsed.manualReferences))
		) {
			return null;
		}

		return {
			prompt: parsed.prompt,
			selectedModels: parsed.selectedModels.filter((model): model is string => typeof model === "string"),
			aspectRatio: parsed.aspectRatio as AspectRatio,
			resolution: parsed.resolution as Resolution,
			selectedProjectId: parsed.selectedProjectId ?? null,
			manualReferences: (parsed.manualReferences ?? []).filter(
				(reference): reference is ImagesPageReference =>
					typeof reference === "object" &&
					reference !== null &&
					"storageId" in reference &&
					"previewUrl" in reference &&
					typeof reference.storageId === "string" &&
					typeof reference.previewUrl === "string"
			),
			filterProjectId: parsed.filterProjectId ?? null,
			filterModel: parsed.filterModel ?? "all",
			filterSource,
			sortOrder,
			viewMode,
		};
	} catch (error) {
		console.error("Failed to load /images page state:", error);
		return null;
	}
}

export function saveImagesPageState(state: ImagesPageState) {
	if (!browser) return;

	memoryState = {
		...state,
		selectedModels: [...state.selectedModels],
		manualReferences: state.manualReferences.map((reference) => ({ ...reference })),
	};

	const sessionState: ImagesPageState = {
		prompt: state.prompt,
		selectedModels: [...state.selectedModels],
		aspectRatio: state.aspectRatio,
		resolution: state.resolution,
		selectedProjectId: state.selectedProjectId,
		manualReferences: state.manualReferences.map((reference) => ({ ...reference })),
		filterProjectId: state.filterProjectId,
		filterModel: state.filterModel,
		filterSource: state.filterSource,
		sortOrder: state.sortOrder,
		viewMode: state.viewMode,
	};

	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessionState));
	} catch (error) {
		console.error("Failed to save /images page state:", error);
	}
}
