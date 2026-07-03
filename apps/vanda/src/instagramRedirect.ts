export const INSTAGRAM_CALLBACK_PATH = "/api/integrations/instagram/callback";

function toCallbackUri(origin: string) {
  return `${origin}${INSTAGRAM_CALLBACK_PATH}`;
}

function getBrowserOrigin() {
  if (typeof window === "undefined") return null;
  return window.location.origin;
}

function isPublicHttpsOrigin(origin: string) {
  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === "https:" && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
  } catch {
    return false;
  }
}

export function getInstagramRedirectUri() {
  const browserOrigin = getBrowserOrigin();
  if (browserOrigin && isPublicHttpsOrigin(browserOrigin)) {
    return toCallbackUri(browserOrigin);
  }

  const configured =
    import.meta.env.VITE_INSTAGRAM_REDIRECT_URI ?? import.meta.env.PUBLIC_INSTAGRAM_REDIRECT_URI;
  if (configured) return configured;

  if (browserOrigin) return toCallbackUri(browserOrigin);

  return INSTAGRAM_CALLBACK_PATH;
}
