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
	/** AI compose in flight (survives navigation when persisted) */
	aiComposePending?: boolean;
	aiComposeStartedAt?: number;
	aiTemplateId?: string | null;
	aiImageModel?: string;
	aiResolution?: string;
};

const STORAGE_KEY = "vanda:post-composer-state:v2";

const STALE_COMPOSE_MS = 15 * 60 * 1000;

let memoryState: Record<string, PostComposerState> | null = null;

/** Clone and drop optional keys whose value is undefined (exactOptionalPropertyTypes). */
function cloneState(state: PostComposerState): PostComposerState {
	const { selectedMediaIds, ...rest } = state;
	const record: Record<string, unknown> = { ...rest, selectedMediaIds: [...selectedMediaIds] };
	for (const key of Object.keys(record)) {
		if (record[key] === undefined) {
			delete record[key];
		}
	}
	return record as PostComposerState;
}

function normalizeLoadedState(raw: PostComposerState): PostComposerState {
	const out: PostComposerState = {
		selectedProjectId: raw.selectedProjectId,
		selectedMediaIds: [...raw.selectedMediaIds],
		captionBrief: raw.captionBrief,
		caption: raw.caption,
		title: raw.title,
		captionModel: raw.captionModel,
		platform: raw.platform,
		includeProjectContext: raw.includeProjectContext,
		previewIndex: raw.previewIndex,
	};
	if (raw.aiComposePending === true) {
		out.aiComposePending = true;
	}
	if (typeof raw.aiComposeStartedAt === "number") {
		out.aiComposeStartedAt = raw.aiComposeStartedAt;
	}
	if (typeof raw.aiTemplateId === "string" || raw.aiTemplateId === null) {
		out.aiTemplateId = raw.aiTemplateId;
	}
	if (typeof raw.aiImageModel === "string") {
		out.aiImageModel = raw.aiImageModel;
	}
	if (typeof raw.aiResolution === "string") {
		out.aiResolution = raw.aiResolution;
	}
	return out;
}

type ComposerPatch = Partial<Record<keyof PostComposerState, PostComposerState[keyof PostComposerState] | undefined>>;

/** `undefined` in patch removes that optional key from the merged result. */
function mergeComposerPartial(base: PostComposerState, patch: ComposerPatch): PostComposerState {
	const next = cloneState(base);
	const record = next as Record<string, unknown>;
	for (const [key, val] of Object.entries(patch) as [string, unknown][]) {
		if (val === undefined) {
			delete record[key];
			continue;
		}
		if (key === "selectedMediaIds" && Array.isArray(val)) {
			next.selectedMediaIds = [...val];
		} else {
			record[key] = val;
		}
	}
	return next;
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
			Object.entries(parsed)
				.filter(([, state]) => {
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
				.map(([key, state]) => [key, normalizeLoadedState(state)])
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

/**
 * Merge partial into storage using the current in-memory snapshot as base (compose start, etc.).
 */
export function mergePostComposerStateFromLive(
	key: string,
	patch: ComposerPatch,
	live: PostComposerState
) {
	if (!browser) return;
	savePostComposerState(key, mergeComposerPartial(live, patch));
}

/**
 * Merge partial into whatever is already in sessionStorage (success after navigation away).
 * Returns false if there is no stored row for this key.
 */
export function mergePostComposerStateFromStorage(key: string, patch: ComposerPatch): boolean {
	if (!browser) return false;
	const base = loadPostComposerState(key);
	if (!base) return false;
	savePostComposerState(key, mergeComposerPartial(base, patch));
	return true;
}

export function isAiComposeStale(state: PostComposerState): boolean {
	if (!state.aiComposePending || typeof state.aiComposeStartedAt !== "number") {
		return false;
	}
	return Date.now() - state.aiComposeStartedAt > STALE_COMPOSE_MS;
}

export { STALE_COMPOSE_MS };
