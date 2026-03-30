import { Effect } from "effect";
import {
    ImageGeneration,
    runAiEffectOrThrow,
    type AspectRatio,
    type ReferenceImage,
    type Resolution,
} from "../llm/index";

// ============================================================================
// System Prompt — base rules shared across modes
// ============================================================================

const BASE_RULES_PRODUCT = `## Important Rules
- NO text, words, letters, or typography in the image UNLESS explicitly requested in the user instructions
- For PRODUCT / BRAND reference images: preserve the EXACT appearance of products/packaging
- Do not invent or change brand names, logos, or label text from those references`;

const BASE_RULES_LAYOUT = `## Important Rules (layout-driven post)
- Include on-image typography when the user instructions provide headlines, body copy, handles, or labels — render in Brazilian Portuguese as given
- Match the typographic HIERARCHY, ALIGNMENT, and PLACEMENT of the layout reference images; do not copy literal wording from those references
- Use user and brand brief for all text content unless the user asks otherwise
- For PRODUCT / BRAND reference images (if any): preserve exact product appearance; do not distort packaging or logos`;

const PHOTOREALISTIC_PROMPT = `Generate a photorealistic Instagram image.

## Core Requirements
- PHOTOREALISTIC - Must look like a real photograph taken with a professional camera
- NOT digital art, illustrations, or CGI renders
- Professional quality suitable for Instagram (1200x1200px square)
- Sharp focus, proper lighting, realistic colors

## Technical Specifications
- Camera: Professional DSLR quality (Canon 5D, Sony A7, etc.)
- Lighting: Natural light or professional studio lighting
- Post-processing: Subtle, realistic color grading
- Resolution: High quality, Instagram-ready

`;

const GENERIC_BASE_PROMPT = `## Core Requirements
- Professional quality suitable for Instagram
- Visually compelling composition
- High resolution, Instagram-ready

`;

// ============================================================================
// Types
// ============================================================================

export interface ImageInput {
    /** The caption to visualize */
    caption: string;
    /** User instructions for the image (e.g., "white background", "lifestyle shot") */
    instructions?: string;
    /**
     * Legacy: all references treated as product/brand assets.
     * Prefer `productReferenceUrls` when also passing layout references.
     */
    referenceImageUrls?: string[];
    /** Layout/composition template references (first in multimodal order) */
    layoutReferenceUrls?: string[];
    /** Product, packaging, or brand asset references (after layout refs) */
    productReferenceUrls?: string[];
    /** Long-form layout instructions (from post template catalog) */
    layoutVisionPrompt?: string;
    /** Model to use for generation */
    model?: string;
    /** Aspect ratio for the image */
    aspectRatio?: AspectRatio;
    /** Resolution for the image */
    resolution?: Resolution;
    /** Style preset prompt text — replaces the default photorealistic opener */
    stylePreset?: string;
}

export interface ImageOutput {
    imageBase64: string;
    mimeType: string;
    /** The full prompt used for generation (for debugging/history) */
    prompt: string;
    /** Dimensions of the generated image */
    dimensions?: { width: number; height: number };
}

// ============================================================================
// Implementation
// ============================================================================

function resolveReferenceGroups(input: ImageInput): {
    layoutUrls: string[];
    productUrls: string[];
} {
    const layoutUrls = input.layoutReferenceUrls ?? [];
    const productUrls =
        input.productReferenceUrls !== undefined
            ? input.productReferenceUrls
            : (input.referenceImageUrls ?? []);
    return { layoutUrls, productUrls };
}

function buildReferenceInstructions(layoutCount: number, productCount: number, vision?: string): string {
    const parts: string[] = [];

    if (layoutCount > 0) {
        parts.push(`## Layout composition references
The first ${layoutCount} attached image(s) are LAYOUT and COMPOSITION references only.
Recreate the same structure, spacing, palette family, type pairing (serif vs sans roles), and overall editorial feel.
${vision ? `\n### Template vision\n${vision}\n` : ""}`);
    }

    if (productCount > 0) {
        const startIndex = layoutCount + 1;
        const endIndex = layoutCount + productCount;
        const range =
            layoutCount > 0
                ? `image(s) #${startIndex} through #${endIndex}`
                : `attached ${productCount} image(s)`;
        parts.push(`## Product and brand references
The ${range} show actual products or brand assets. You MUST:
- PRESERVE the EXACT appearance (packaging, labels, colors, textures)
- DO NOT invent or modify brand names, logos, or text on products
- Reproduce products IDENTICALLY as shown`);
    }

    return parts.join("\n\n");
}

function buildBaseRulesSuffix(layoutCount: number, productCount: number): string {
    if (layoutCount > 0 && productCount > 0) {
        return `${BASE_RULES_LAYOUT}\n\n(Also apply product fidelity rules above for product reference images.)`;
    }
    if (layoutCount > 0) {
        return BASE_RULES_LAYOUT;
    }
    return BASE_RULES_PRODUCT;
}

/**
 * Build the image generation prompt
 */
function buildImagePrompt(input: ImageInput): string {
    const { layoutUrls, productUrls } = resolveReferenceGroups(input);
    const layoutCount = layoutUrls.length;
    const productCount = productUrls.length;

    const parts: string[] = [];

    if (input.stylePreset) {
        parts.push(`## Image Style\n${input.stylePreset}\n`);
    } else {
        parts.push("Create a photorealistic Instagram image.\n");
    }

    parts.push(
        `## Caption Context\nThe image should complement this caption:\n"${input.caption}"\n`
    );

    const refBlock = buildReferenceInstructions(
        layoutCount,
        productCount,
        input.layoutVisionPrompt
    );
    if (refBlock) {
        parts.push(refBlock + "\n");
    }

    if (input.instructions) {
        parts.push(`## User Instructions (IMPORTANT - Follow these)\n${input.instructions}\n`);
    }

    parts.push(buildBaseRulesSuffix(layoutCount, productCount));

    const styleTail = input.stylePreset ? GENERIC_BASE_PROMPT : PHOTOREALISTIC_PROMPT;
    parts.push(styleTail);

    return parts.join("\n");
}

function buildReferenceImagesForModel(input: ImageInput): ReferenceImage[] {
    const { layoutUrls, productUrls } = resolveReferenceGroups(input);
    const refs: ReferenceImage[] = [];
    for (const url of layoutUrls) {
        refs.push({
            url,
            description: "Layout composition reference — match structure and hierarchy, not literal text.",
        });
    }
    for (const url of productUrls) {
        refs.push({
            url,
            description: "Product or brand asset — preserve exact appearance.",
        });
    }
    return refs;
}

/**
 * Generate an image based on caption and instructions
 */
export async function generateImage(input: ImageInput): Promise<ImageOutput> {
    const prompt = buildImagePrompt(input);
    const referenceImages = buildReferenceImagesForModel(input);

    const result = await runAiEffectOrThrow(
        Effect.gen(function* () {
            const imageGen = yield* ImageGeneration;
            return yield* imageGen.generateImage({
                prompt,
                ...(referenceImages.length > 0 && { referenceImages }),
                ...(input.model && { model: input.model }),
                ...(input.aspectRatio && { aspectRatio: input.aspectRatio }),
                ...(input.resolution && { resolution: input.resolution }),
            });
        })
    );

    return {
        imageBase64: result.imageBase64,
        mimeType: result.mimeType,
        prompt,
        ...(result.dimensions && { dimensions: result.dimensions }),
    };
}
