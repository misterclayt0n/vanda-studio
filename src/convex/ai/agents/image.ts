import { Effect } from "effect";
import { ImageGeneration, MODELS, runAiEffectOrThrow } from "../llm/index";

// ============================================================================
// System Prompt
// ============================================================================

const BASE_PROMPT = `Generate a photorealistic Instagram image.

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

## Important Rules
- NO text, words, letters, or typography in the image UNLESS explicitly requested
- If reference images are provided, preserve the EXACT appearance of products/packaging
- Do not invent or change brand names, logos, or label text from references`;

// ============================================================================
// Types
// ============================================================================

export interface ImageInput {
    /** The caption to visualize */
    caption: string;
    /** User instructions for the image (e.g., "white background", "lifestyle shot") */
    instructions?: string;
    /** Reference image URLs (external URLs or Convex storage URLs) */
    referenceImageUrls?: string[];
}

export interface ImageOutput {
    imageBase64: string;
    mimeType: string;
    /** The full prompt used for generation (for debugging/history) */
    prompt: string;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Build the image generation prompt
 */
function buildImagePrompt(input: ImageInput): string {
    const parts: string[] = [];

    parts.push("Create a photorealistic Instagram image.\n");

    // Caption context
    parts.push(`## Caption Context\nThe image should complement this caption:\n"${input.caption}"\n`);

    // User instructions (highest priority)
    if (input.instructions) {
        parts.push(`## User Instructions (IMPORTANT - Follow these)\n${input.instructions}\n`);
    }

    // Reference images note
    if (input.referenceImageUrls && input.referenceImageUrls.length > 0) {
        parts.push(`## Reference Images\nThe attached ${input.referenceImageUrls.length} image(s) show the actual products/brand. You MUST:\n- PRESERVE the EXACT appearance (packaging, labels, colors, textures)\n- DO NOT invent or modify brand names, logos, or text\n- Reproduce the product IDENTICALLY as shown\n`);
    }

    // Base requirements
    parts.push(BASE_PROMPT);

    return parts.join("\n");
}

/**
 * Generate an image based on caption and instructions
 */
export async function generateImage(input: ImageInput): Promise<ImageOutput> {
    const prompt = buildImagePrompt(input);

    const result = await runAiEffectOrThrow(
        Effect.gen(function* () {
            const imageGen = yield* ImageGeneration;
            return yield* imageGen.generateImage({
                prompt,
                ...(input.referenceImageUrls &&
                    input.referenceImageUrls.length > 0 && {
                        referenceImages: input.referenceImageUrls.map((url) => ({ url })),
                    }),
            });
        })
    );

    return {
        imageBase64: result.imageBase64,
        mimeType: result.mimeType,
        prompt,
    };
}
