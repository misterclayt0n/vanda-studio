/**
 * Normalize user input (@handle, handle, or full instagram.com URL) to a canonical profile URL
 * stored in Convex (`projects.instagramUrl`).
 */
export function normalizeInstagramInput(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return "";

    const formatHandle = (value: string) => value.replace(/^@/, "").split(/[/?#]/)[0] ?? "";

    if (!trimmed.startsWith("http")) {
        const handle = formatHandle(trimmed);
        return handle ? `https://www.instagram.com/${handle}/` : "";
    }

    try {
        const url = new URL(trimmed);
        const parts = url.pathname.split("/").filter(Boolean);
        const handle = parts[0];
        return handle ? `https://www.instagram.com/${handle}/` : "";
    } catch {
        const handle = formatHandle(trimmed);
        return handle ? `https://www.instagram.com/${handle}/` : "";
    }
}

/** Display value for inputs (e.g. `@clinica_silva`) from stored canonical URL. */
export function formatHandleForInput(storedUrl: string | undefined): string {
    if (!storedUrl?.trim()) return "";
    try {
        const url = new URL(storedUrl.trim());
        const parts = url.pathname.split("/").filter(Boolean);
        const h = parts[0];
        return h ? `@${h}` : "";
    } catch {
        const h = storedUrl.trim().replace(/^@/, "").split(/[/?#]/)[0];
        return h ? `@${h}` : "";
    }
}
