import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, url }) => {
	throw redirect(301, `/library/conversations/${params.conversationId}${url.search}`);
};
