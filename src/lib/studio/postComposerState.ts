import { browser } from "$app/environment";

export type PostComposerState = {
	selectedProjectId: string | null;
	selectedMediaIds: string[];
	captionBrief: string;
	caption: string;
	title: string;
	captionModel: string;
	platform: string;
	includeProjectContext: boolean;
	previewIndex: number;
};

const STORAGE_KEY = "vanda:post-composer-state:v2";

let memoryState: Record<string, PostComposerState> | null = null;

function cloneState(state: PostComposerState): PostComposerState {
	return {
		...state,
		selectedMediaIds: [...state.selectedMediaIds],
	};
}

function loadStateMap(): Record<string, PostComposerState> {
	if (memoryState) {
		return Object.fromEntries(
			Object.entries(memoryState).map(([key, state]) => [key, cloneState(state)])
		);
	}

	if (!browser) return {};

	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return {};

		const parsed = JSON.parse(raw) as Record<string, PostComposerState>;
		const nextState = Object.fromEntries(
			Object.entries(parsed).filter(([, state]) => {
				return (
					typeof state === "object" &&
					state !== null &&
					(state.selectedProjectId === null ||
						state.selectedProjectId === undefined ||
						typeof state.selectedProjectId === "string") &&
					Array.isArray(state.selectedMediaIds) &&
					typeof state.captionBrief === "string" &&
					typeof state.caption === "string" &&
					typeof state.title === "string" &&
					typeof state.captionModel === "string" &&
					typeof state.platform === "string" &&
					typeof state.includeProjectContext === "boolean" &&
					typeof state.previewIndex === "number"
				);
			})
		);

		memoryState = Object.fromEntries(
			Object.entries(nextState).map(([key, state]) => [key, cloneState(state)])
		);

		return nextState;
	} catch (error) {
		console.error("Failed to load post composer state:", error);
		return {};
	}
}

function saveStateMap(stateMap: Record<string, PostComposerState>) {
	if (!browser) return;

	memoryState = Object.fromEntries(
		Object.entries(stateMap).map(([key, state]) => [key, cloneState(state)])
	);

	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateMap));
	} catch (error) {
		console.error("Failed to save post composer state:", error);
	}
}

export function loadPostComposerState(key: string): PostComposerState | null {
	if (!browser) return null;
	const state = loadStateMap()[key];
	return state ? cloneState(state) : null;
}

export function savePostComposerState(key: string, state: PostComposerState) {
	if (!browser) return;
	const stateMap = loadStateMap();
	stateMap[key] = cloneState(state);
	saveStateMap(stateMap);
}

export function clearPostComposerState(key: string) {
	if (!browser) return;
	const stateMap = loadStateMap();
	delete stateMap[key];
	saveStateMap(stateMap);
}
