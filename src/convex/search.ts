type SearchField = {
    value: string | null | undefined;
    weight: number;
};

type RankedSearchMatch = {
    normalizedQuery: string;
    normalizedTokens: string[];
    score: number;
};

export const IMAGE_MODEL_DISPLAY_NAMES: Record<string, string> = {
    "google/gemini-2.5-flash-image": "Nano Banana",
    "google/gemini-3.1-flash-image-preview": "Nano Banana 2",
    "google/gemini-3-pro-image-preview": "Nano Banana Pro",
    "bytedance-seed/seedream-4.5": "SeeDream v4.5",
    "black-forest-labs/flux.2-flex": "Flux 2 Flex",
    "openai/gpt-5-image": "GPT Image 1.5",
};

export const MEDIA_SOURCE_LABELS: Record<string, string> = {
    generated: "Gerada por IA",
    uploaded: "Upload manual",
    edited: "Editada",
    imported: "Importada",
};

export function normalizeSearchText(value: string | null | undefined): string {
    if (!value) {
        return "";
    }

    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

export function tokenizeSearchQuery(query: string): string[] {
    const normalized = normalizeSearchText(query);
    return normalized ? normalized.split(" ") : [];
}

function fieldTokens(value: string): string[] {
    return value.split(" ").filter(Boolean);
}

function fieldMatchesAllTokens(value: string, queryTokens: string[]): boolean {
    const tokens = fieldTokens(value);
    return queryTokens.every((queryToken) =>
        tokens.some((token) => token === queryToken || token.startsWith(queryToken))
    );
}

export function getImageModelDisplayName(model?: string | null): string | null {
    if (!model) {
        return null;
    }

    return IMAGE_MODEL_DISPLAY_NAMES[model] ?? model.split("/").pop() ?? model;
}

export function getMediaSourceLabel(sourceType: string): string {
    return MEDIA_SOURCE_LABELS[sourceType] ?? sourceType;
}

export function rankSearchMatch(
    query: string,
    fields: SearchField[],
): RankedSearchMatch | null {
    const normalizedQuery = normalizeSearchText(query);
    const normalizedTokens = tokenizeSearchQuery(query);

    if (!normalizedQuery || normalizedTokens.length === 0) {
        return null;
    }

    const normalizedFields = fields
        .map((field) => ({
            value: normalizeSearchText(field.value),
            weight: field.weight,
        }))
        .filter((field) => field.value.length > 0);

    if (normalizedFields.length === 0) {
        return null;
    }

    let score = 0;
    let matchedFieldCount = 0;

    for (const field of normalizedFields) {
        if (!fieldMatchesAllTokens(field.value, normalizedTokens)) {
            continue;
        }

        matchedFieldCount += 1;

        if (field.value === normalizedQuery) {
            score += field.weight * 12;
            continue;
        }

        if (field.value.startsWith(normalizedQuery)) {
            score += field.weight * 9;
        } else if (field.value.includes(normalizedQuery)) {
            score += field.weight * 7;
        }

        for (const token of normalizedTokens) {
            if (field.value === token) {
                score += field.weight * 5;
            } else if (field.value.startsWith(token)) {
                score += field.weight * 4;
            } else if (fieldTokens(field.value).some((candidate) => candidate.startsWith(token))) {
                score += field.weight * 2;
            }
        }
    }

    if (matchedFieldCount === 0) {
        return null;
    }

    return {
        normalizedQuery,
        normalizedTokens,
        score,
    };
}
