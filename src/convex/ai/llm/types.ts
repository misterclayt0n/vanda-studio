// ============================================================================
// Aspect Ratios
// ============================================================================

export const ASPECT_RATIOS = {
    "1:1": { width: 1, height: 1, label: "1:1" },
    "16:9": { width: 16, height: 9, label: "16:9" },
    "9:16": { width: 9, height: 16, label: "9:16" },
    "4:3": { width: 4, height: 3, label: "4:3" },
    "3:4": { width: 3, height: 4, label: "3:4" },
    "21:9": { width: 21, height: 9, label: "21:9" },
} as const;

export type AspectRatio = keyof typeof ASPECT_RATIOS;

export const ASPECT_RATIO_LIST = Object.keys(ASPECT_RATIOS) as AspectRatio[];

// ============================================================================
// Resolutions
// ============================================================================

export const RESOLUTIONS = {
    standard: {
        label: "Standard",
        description: "1K resolution",
        baseSize: 1024,
    },
    high: {
        label: "High",
        description: "2K resolution",
        baseSize: 2048,
    },
    ultra: {
        label: "Ultra",
        description: "4K resolution",
        baseSize: 4096,
    },
} as const;

export type Resolution = keyof typeof RESOLUTIONS;

export const RESOLUTION_LIST = Object.keys(RESOLUTIONS) as Resolution[];

// ============================================================================
// Dimension Calculation
// ============================================================================

export interface Dimensions {
    width: number;
    height: number;
}

/**
 * Calculate pixel dimensions from aspect ratio and resolution.
 * The larger dimension will equal the baseSize, and the smaller
 * dimension is calculated to maintain the aspect ratio.
 */
export function calculateDimensions(
    aspectRatio: AspectRatio,
    resolution: Resolution
): Dimensions {
    const { width: w, height: h } = ASPECT_RATIOS[aspectRatio];
    const { baseSize } = RESOLUTIONS[resolution];

    // Scale so the larger dimension equals baseSize
    const scale = baseSize / Math.max(w, h);

    return {
        width: Math.round(w * scale),
        height: Math.round(h * scale),
    };
}

/**
 * Format dimensions as a size string (e.g., "1024x1024")
 */
export function formatDimensions(dimensions: Dimensions): string {
    return `${dimensions.width}x${dimensions.height}`;
}

/**
 * Get size string directly from aspect ratio and resolution
 */
export function getSizeString(
    aspectRatio: AspectRatio,
    resolution: Resolution
): string {
    return formatDimensions(calculateDimensions(aspectRatio, resolution));
}
