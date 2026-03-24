/**
 * Basic SSRF hygiene for server-side URL fetch (user-supplied URLs only).
 */

const BLOCKED_HOSTNAMES = new Set([
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "metadata.google.internal",
    "metadata.goog",
]);

export class UnsafeUrlError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UnsafeUrlError";
    }
}

function isBlockedIpv4(host: string): boolean {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (!m) return false;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
}

/**
 * Returns normalized https? URL or throws UnsafeUrlError.
 */
export function assertSafePublicHttpUrl(raw: string): URL {
    let parsed: URL;
    try {
        parsed = new URL(raw.trim());
    } catch {
        throw new UnsafeUrlError("URL inválida");
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new UnsafeUrlError("Apenas http(s) é permitido");
    }

    const host = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(host)) {
        throw new UnsafeUrlError("Host não permitido");
    }
    if (host.endsWith(".local") || host.endsWith(".localhost")) {
        throw new UnsafeUrlError("Host não permitido");
    }
    if (isBlockedIpv4(host)) {
        throw new UnsafeUrlError("Endereço IP privado não permitido");
    }

    return parsed;
}
