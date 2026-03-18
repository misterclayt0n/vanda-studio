import { browser } from "$app/environment";
import type { AspectRatio, Resolution } from "$lib/studio/imageGenerationCapabilities";

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
	searchQuery: string;
	filterProjectId: string | null;
	viewMode: ImagesPageViewMode;
};

const STORAGE_KEY = "vanda:images-page-state:v1";

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
		if (
			typeof parsed.prompt !== "string" ||
			!Array.isArray(parsed.selectedModels) ||
			typeof parsed.aspectRatio !== "string" ||
			typeof parsed.resolution !== "string" ||
			typeof parsed.searchQuery !== "string" ||
			(parsed.selectedProjectId !== null && typeof parsed.selectedProjectId !== "string") ||
			(parsed.filterProjectId !== null && typeof parsed.filterProjectId !== "string") ||
			(parsed.viewMode !== "images" && parsed.viewMode !== "conversations") ||
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
			searchQuery: parsed.searchQuery,
			filterProjectId: parsed.filterProjectId ?? null,
			viewMode: parsed.viewMode,
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
		searchQuery: state.searchQuery,
		filterProjectId: state.filterProjectId,
		viewMode: state.viewMode,
	};

	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessionState));
	} catch (error) {
		console.error("Failed to save /images page state:", error);
	}
}
