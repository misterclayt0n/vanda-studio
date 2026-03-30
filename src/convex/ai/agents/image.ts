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
- The attached TEMPLATE reference is the primary authority for visual design: palette family, type pairing (serif vs sans roles), shapes, borders, patterns, illustration vs photograph, and overall graphic language. Match its hierarchy, alignment, and placement closely; do not copy literal wording from the template image
- User / brand brief supplies text content, factual claims, handles, and (via Diretrizes de imagem) subject matter for photographic regions — not a competing art direction. If the brief lists hex colors or font names, treat them as brand identity for copy and subtle accents unless the user explicitly asks to ignore the template; default is to follow the template's look
- For PRODUCT / BRAND asset reference images (if any): preserve exact product appearance; do not distort packaging or logos
- For FEED / STYLE context images (if any): lowest priority — subtle mood only; they must NOT override the template's layout or dominant palette`;

const TEMPLATE_MODE_OPENER = `Create an Instagram post image that closely matches the attached TEMPLATE reference in composition, color system, typography style, and graphic language (flat, mixed, or photorealistic — follow the template, not a generic default).

`;

const TEMPLATE_MODE_TAIL = `## Output medium
Match the template reference's realism level: if it is a flat graphic / carousel slide design, keep that style; if it is a lifestyle photograph with overlays, keep that. Do not force a DSLR photograph look when the template is clearly graphic design.

`;

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
    /**
     * Feed / moodboard examples (after product refs). Not pixel-fidelity assets.
     * Infer palette motifs and graphic attitude; do not copy posts literally.
     */
    styleReferenceUrls?: string[];
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
    styleUrls: string[];
} {
    const layoutUrls = input.layoutReferenceUrls ?? [];
    const styleUrls = input.styleReferenceUrls ?? [];
    const productUrls =
        input.productReferenceUrls !== undefined
            ? input.productReferenceUrls
            : (input.referenceImageUrls ?? []);
    return { layoutUrls, productUrls, styleUrls };
}

function buildReferenceInstructions(
    layoutCount: number,
    productCount: number,
    styleCount: number,
    vision?: string
): string {
    const parts: string[] = [];

    if (layoutCount > 0) {
        parts.push(`## Template reference (primary visual source)
The first ${layoutCount} attached image(s) are the TEMPLATE to follow.

Reproduce closely:
- Overall layout, regions, and hierarchy (panels, bands, photo vs text zones, centered vs aligned stacks)
- Palette family, contrast, and decorative treatment (borders, patterns, icons, line work)
- Typography roles and attitude (serif vs sans pairing, weight, casing, scale steps) as shown
- Illustration vs photography vs mixed — match the template's medium

Brand brief color lists and font names are secondary: use them for wording context and small accents unless the user explicitly asks to depart from the template. Default = template wins visually.

Do NOT copy literal text, headlines, slogans, or button labels from the template image — all on-image copy must come from User Instructions (pt-BR) as specified below.
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

    if (styleCount > 0) {
        const startIndex = layoutCount + productCount + 1;
        const endIndex = layoutCount + productCount + styleCount;
        parts.push(`## Feed and style context references (lowest priority)
Attached image(s) #${startIndex} through #${endIndex} are optional brand feed or moodboard hints.

They are SUBORDINATE to the template reference above: do NOT replace the template's layout, palette, or dominant graphic language with a feed screenshot look.

You may take only subtle cues (e.g. energy, category) if they do not conflict with the template.

Rules:
- Do NOT copy any single post, layout block, or headline literally from these images
- Do NOT reproduce Instagram profile chrome, grids, or app UI as the output`);
    }

    return parts.join("\n\n");
}

function buildBaseRulesSuffix(
    layoutCount: number,
    productCount: number,
    styleCount: number
): string {
    const layoutNote =
        productCount > 0
            ? "\n\n(Also apply product fidelity rules above for product reference images.)"
            : "";
    const styleNote =
        styleCount > 0
            ? "\n\n(Feed/style context: lowest priority vs template — never override template layout or palette.)"
            : "";

    if (layoutCount > 0) {
        return `${BASE_RULES_LAYOUT}${layoutNote}${styleNote}`;
    }
    let suffix = BASE_RULES_PRODUCT;
    if (styleCount > 0) {
        suffix += styleNote;
    }
    return suffix;
}

/**
 * Build the image generation prompt
 */
function buildImagePrompt(input: ImageInput): string {
    const { layoutUrls, productUrls, styleUrls } = resolveReferenceGroups(input);
    const layoutCount = layoutUrls.length;
    const productCount = productUrls.length;
    const styleCount = styleUrls.length;

    const parts: string[] = [];

    if (input.stylePreset) {
        parts.push(`## Image Style\n${input.stylePreset}\n`);
    } else if (layoutCount > 0) {
        parts.push(TEMPLATE_MODE_OPENER);
    } else {
        parts.push("Create a photorealistic Instagram image.\n");
    }

    parts.push(
        `## Caption Context\nThe image should complement this caption:\n"${input.caption}"\n`
    );

    const refBlock = buildReferenceInstructions(
        layoutCount,
        productCount,
        styleCount,
        input.layoutVisionPrompt
    );
    if (refBlock) {
        parts.push(refBlock + "\n");
    }

    if (input.instructions) {
        parts.push(`## User Instructions (IMPORTANT - Follow these)\n${input.instructions}\n`);
    }

    parts.push(buildBaseRulesSuffix(layoutCount, productCount, styleCount));

    const styleTail = input.stylePreset
        ? GENERIC_BASE_PROMPT
        : layoutCount > 0
          ? TEMPLATE_MODE_TAIL
          : PHOTOREALISTIC_PROMPT;
    parts.push(styleTail);

    return parts.join("\n");
}

function buildReferenceImagesForModel(input: ImageInput): ReferenceImage[] {
    const { layoutUrls, productUrls, styleUrls } = resolveReferenceGroups(input);
    const refs: ReferenceImage[] = [];
    for (const url of layoutUrls) {
        refs.push({
            url,
            description:
                "Template reference — match this image's layout, palette, typography style, and graphic design closely. On-image words come from the text prompt, not from copying this image.",
        });
    }
    for (const url of productUrls) {
        refs.push({
            url,
            description: "Product or brand asset — preserve exact appearance.",
        });
    }
    for (const url of styleUrls) {
        refs.push({
            url,
            description:
                "Optional brand feed context — lowest priority vs the template reference; do not copy posts literally.",
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
