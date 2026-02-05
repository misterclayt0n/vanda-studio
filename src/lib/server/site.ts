export type Site = "app" | "www";

export type HostInfo = {
	hostname: string;
	baseDomain: string;
	appHost: string;
	wwwHost: string;
	isAppHost: boolean;
	isWwwHost: boolean;
	isLocalhost: boolean;
	site: Site;
};

export function getHostInfo(request: Request, url: URL): HostInfo {
	const hostHeader =
		request.headers.get("x-forwarded-host") ??
		request.headers.get("host") ??
		url.host ??
		"";

	const hostname = hostHeader.split(",")[0]?.trim().split(":")[0]?.toLowerCase() ?? "";
	const isBareLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
	const isLocalhost = isBareLocalhost || hostname.endsWith(".localhost");

	const baseDomain =
		hostname.startsWith("app.") || hostname.startsWith("www.")
			? hostname.slice(4)
			: hostname;

	const appHost = `app.${baseDomain}`;
	const wwwHost = `www.${baseDomain}`;
	const isAppHost = hostname === appHost;
	const isWwwHost = hostname === wwwHost || hostname === baseDomain;

	let site: Site;
	if (isAppHost) {
		site = "app";
	} else if (isWwwHost) {
		site = isBareLocalhost ? "app" : "www";
	} else {
		site = isBareLocalhost ? "app" : "www";
	}

	return {
		hostname,
		baseDomain,
		appHost,
		wwwHost,
		isAppHost,
		isWwwHost,
		isLocalhost,
		site
	};
}
