import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

// The dedicated `/posts/[postId]` page was replaced by the in-lightbox editor
// in `/library`. Redirect preserves the specific post via the `viewPost` param.
export const load: PageServerLoad = ({ params }) => {
	throw redirect(301, `/library?viewPost=${params.postId}`);
};
