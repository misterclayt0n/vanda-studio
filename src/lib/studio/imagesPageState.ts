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
	useProjectContext: boolean;
	selectedPreset: string;
};

const STORAGE_KEY_V6 = "vanda:images-page-state:v6";
const STORAGE_KEY_V5 = "vanda:images-page-state:v5";
const STORAGE_KEY_V4 = "vanda:images-page-state:v4";
const STORAGE_KEY_V3 = "vanda:images-page-state:v3";

let memoryState: ImagesPageState | null = null;
type SessionState = Partial<ImagesPageState & { generationMode?: string }>;

function parseAndValidate(parsed: SessionState): ImagesPageState | null {
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
		useProjectContext: parsed.useProjectContext ?? true,
		selectedPreset: typeof parsed.selectedPreset === "string" ? parsed.selectedPreset : "photorealistic",
	};
}

/** v4 stored generationMode; when "free", template was always cleared in UI — keep that one-time migration */
function migrateFromV4(parsed: SessionState): ImagesPageState | null {
	const base = parseAndValidate(parsed);
	if (!base) return null;
	if (parsed.generationMode === "free") {
		return base;
	}
	return base;
}

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
		const rawV6 = sessionStorage.getItem(STORAGE_KEY_V6);
		if (rawV6) {
			const parsed = JSON.parse(rawV6) as SessionState;
			const state = parseAndValidate(parsed);
			if (state) return state;
		}

		const rawV5 = sessionStorage.getItem(STORAGE_KEY_V5);
		if (rawV5) {
			const parsed = JSON.parse(rawV5) as SessionState;
			const state = parseAndValidate(parsed);
			if (state) return state;
		}

		const rawV4 = sessionStorage.getItem(STORAGE_KEY_V4);
		if (rawV4) {
			const parsed = JSON.parse(rawV4) as SessionState;
			const state = migrateFromV4(parsed);
			if (state) return state;
		}

		const rawV3 = sessionStorage.getItem(STORAGE_KEY_V3);
		if (rawV3) {
			const parsed = JSON.parse(rawV3) as SessionState;
			const base = parseAndValidate(parsed);
			if (base) {
				return base;
			}
		}
	} catch (error) {
		console.error("Failed to load /images page state:", error);
		return null;
	}

	return null;
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
		useProjectContext: state.useProjectContext,
		selectedPreset: state.selectedPreset,
	};

	try {
		sessionStorage.setItem(STORAGE_KEY_V6, JSON.stringify(sessionState));
		sessionStorage.removeItem(STORAGE_KEY_V5);
		sessionStorage.removeItem(STORAGE_KEY_V4);
		sessionStorage.removeItem(STORAGE_KEY_V3);
	} catch (error) {
		console.error("Failed to save /images page state:", error);
	}
}
