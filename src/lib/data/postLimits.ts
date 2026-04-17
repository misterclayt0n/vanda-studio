/**
 * Platform-level limits for composed posts. Keep in sync with the platforms'
 * published carousel/media rules.
 */

/** Instagram feed carousel: up to 20 photos/videos (2025 limit). */
export const INSTAGRAM_CAROUSEL_MAX = 20;

/** Default per-post cap used across composer UIs and append mutations. */
export const DEFAULT_POST_MEDIA_MAX = INSTAGRAM_CAROUSEL_MAX;

export function remainingPostSlots(currentCount: number, max = DEFAULT_POST_MEDIA_MAX): number {
	return Math.max(0, max - Math.max(0, currentCount));
}
