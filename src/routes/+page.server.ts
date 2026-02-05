import type { PageServerLoad } from "./$types";
import { getHostInfo } from "$lib/server/site";

export const load: PageServerLoad = ({ request, url }) => {
	const { site } = getHostInfo(request, url);
	return { site };
};
