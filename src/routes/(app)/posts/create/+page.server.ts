import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

// The `/posts/create` composer was replaced by inline editing inside the
// library's post lightbox. If a legacy URL is visited, route the user into the
// library (carrying over a specific post if one was referenced).
export const load: PageServerLoad = ({ url }) => {
	const postId = url.searchParams.get("postId");
	if (postId) {
		throw redirect(301, `/library?viewPost=${postId}`);
	}
	throw redirect(301, `/library${url.search}`);
};
