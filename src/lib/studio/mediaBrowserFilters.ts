export type MediaSortOrder = "newest" | "oldest";
export type MediaSourceFilter = "all" | "edited" | "generated_uploaded";

export type FilterableMediaItem = {
	projectId?: string | null;
	model?: string | null;
	sourceType: string;
	createdAt: number;
};

export const mediaModelDisplayNames: Record<string, string> = {
	"google/gemini-2.5-flash-image": "Nano Banana",
	"google/gemini-3.1-flash-image-preview": "Nano Banana 2",
	"google/gemini-3-pro-image-preview": "Nano Banana Pro",
	"bytedance-seed/seedream-4.5": "SeeDream v4.5",
	"black-forest-labs/flux.2-flex": "Flux 2 Flex",
	"openai/gpt-5-image": "GPT Image 1.5",
};

export function getMediaModelDisplayName(model?: string | null): string {
	if (!model) return "Imagem";
	return mediaModelDisplayNames[model] ?? model.split("/").pop() ?? model;
}

export function getMediaSourceLabel(sourceType: string): string {
	switch (sourceType) {
		case "generated":
			return "Gerada por IA";
		case "uploaded":
			return "Upload manual";
		case "edited":
			return "Imagem editada";
		case "imported":
			return "Imagem importada";
		default:
			return sourceType;
	}
}

export function filterMediaItems<T extends FilterableMediaItem>(
	items: T[],
	filters: {
		projectId: string | null;
		model: string;
		source: MediaSourceFilter;
		sortOrder: MediaSortOrder;
	}
): T[] {
	const filtered = items.filter((item) => {
		if (filters.projectId && item.projectId !== filters.projectId) {
			return false;
		}

		if (filters.model !== "all" && item.model !== filters.model) {
			return false;
		}

		if (filters.source === "edited") {
			return item.sourceType === "edited";
		}

		if (filters.source === "generated_uploaded") {
			return item.sourceType === "generated" || item.sourceType === "uploaded";
		}

		return true;
	});

	return filtered.sort((a, b) =>
		filters.sortOrder === "oldest" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt
	);
}

export function getMediaModelOptions(items: Array<{ model?: string | null }>) {
	const seen = new Set<string>();
	const options: Array<{ id: string; label: string }> = [];

	for (const item of items) {
		if (!item.model || seen.has(item.model)) continue;
		seen.add(item.model);
		options.push({ id: item.model, label: getMediaModelDisplayName(item.model) });
	}

	return options.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}
