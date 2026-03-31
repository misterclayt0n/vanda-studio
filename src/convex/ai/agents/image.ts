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

/** Short PACE-style brief (pt-BR). Kept compact so the attached template image stays the main signal. */
const TEMPLATE_PACEFF_PT = `**P · Papel:** Designer de social media para Instagram: peça legível, harmonia visual e adequada ao feed.
**A · Ação:** Use o anexo como guia de **layout** (estrutura, blocos, hierarquia, alinhamentos, proporções). Ajuste **cores, fontes e identidade** ao que o usuário pedir nas instruções. **Não** copie textos, slogans, CTAs nem rótulos literais do template — só o que vier do brief, em **português**, revisado.
**C · Contexto:** Mesma “engenharia” de layout, estética pode variar conforme o brief; corrija ortografia e concordância.
**E · Exemplo (papéis):** Onde o template tem topo, centro, imagem, rodapé ou logo, mantenha **os mesmos papéis visuais**, não o conteúdo congelado da arte de referência.`;

const TEMPLATE_SHORT_OPENER_PT = `Tarefa: gerar uma imagem de post para Instagram.\n`;

const TEMPLATE_SHORT_TAIL_PT = `Meio: siga o mesmo tipo de peça da referência (layout gráfico / ilustração / foto com texto). Não imponha “foto de câmera” se o template for design plano.\n`;

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
        const visionLine = vision?.trim()
            ? `\n**Nota do pacote:** ${vision.trim()}\n`
            : "";
        parts.push(`## Template (referência principal)
As primeiras ${layoutCount} imagem(ns) anexada(s) definem **layout e look dominante**. Tipografia on-image só quando o usuário fornecer textos — em **português (pt-BR)** como nas instruções.

${TEMPLATE_PACEFF_PT}
${visionLine}`);
    }

    if (productCount > 0) {
        const startIndex = layoutCount + 1;
        const endIndex = layoutCount + productCount;
        const range =
            layoutCount > 0
                ? `#${startIndex}–#${endIndex}`
                : `as ${productCount} imagem(ns) anexa(s)`;
        parts.push(`## Produto / marca (${range})
Preserve aparência exata (embalagem, rótulos, cores). Não invente nem altere nomes de marca ou logotipos.`);
    }

    if (styleCount > 0) {
        const startIndex = layoutCount + productCount + 1;
        const endIndex = layoutCount + productCount + styleCount;
        parts.push(`## Feed / estilo (opcional, baixa prioridade)
Imagens #${startIndex}–#${endIndex}: só pistas leves de clima. **Não** substituam o template nem a paleta dele. Não copie posts nem UI do Instagram.`);
    }

    return parts.join("\n\n");
}

function buildBaseRulesSuffix(
    layoutCount: number,
    productCount: number,
    styleCount: number
): string {
    if (layoutCount > 0) {
        let s = "";
        if (productCount > 0) {
            s += "\n\n**Reforço:** nas imagens de produto, fidelidade exata importa mais que “reinterpretação”.";
        }
        if (styleCount > 0) {
            s += "\n\n**Reforço:** referências de feed ficam atrás do template.";
        }
        return s ? `${s}\n` : "";
    }
    let suffix = BASE_RULES_PRODUCT;
    if (styleCount > 0) {
        suffix +=
            "\n\nFeed/estilo: só pistas leves; não copie layouts literais de posts de referência.";
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
        parts.push(TEMPLATE_SHORT_OPENER_PT);
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
          ? TEMPLATE_SHORT_TAIL_PT
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
                "Template de layout para Instagram — copiar estrutura; cores, fontes e textos vêm do brief.",
        });
    }
    for (const url of productUrls) {
        refs.push({
            url,
            description: "Produto ou marca — manter aparência exata.",
        });
    }
    for (const url of styleUrls) {
        refs.push({
            url,
            description: "Contexto de feed — referência leve de estilo, sem copiar o post.",
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
