import type { Action } from "svelte/action";

/**
 * Moves the node to `target` (default `document.body`) so `position: fixed` overlays
 * are not clipped by `overflow: hidden` ancestors.
 */
export const portal: Action<HTMLElement, HTMLElement | undefined> = (node, target) => {
	const el = target ?? (typeof document !== "undefined" ? document.body : null);
	if (!el) return {};

	el.appendChild(node);

	return {
		destroy() {
			if (node.parentNode === el) {
				el.removeChild(node);
			}
		},
	};
};
