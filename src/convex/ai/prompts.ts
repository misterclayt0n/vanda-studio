// Prompt templates for AI generation (PT-BR)

// =============================================================================
// POST TYPE DEFINITIONS AND PROMPTS
// =============================================================================

export type PostType = "promocao" | "conteudo_profissional" | "engajamento";

export const POST_TYPE_LABELS: Record<PostType, string> = {
    promocao: "Promocao",
    conteudo_profissional: "Conteudo Profissional",
    engajamento: "Engajamento",
};

export const POST_TYPE_PROMPTS: Record<PostType, string> = {
    promocao: `TIPO DE POST: Promocional / Vendas
- Foco em conversao e CTA claro e direto
- Destaque beneficios, ofertas e diferenciais
- Crie senso de urgencia quando apropriado
- Use gatilhos mentais de escassez e exclusividade
- Hashtags focadas em vendas e nicho especifico
- Tom persuasivo mas autentico`,

    conteudo_profissional: `TIPO DE POST: Conteudo Profissional / Autoridade
- Demonstre expertise e conhecimento no nicho
- Conteudo informativo, educacional ou inspirador
- Tom confiante, profissional e acessivel
- Agregue valor real para a audiencia
- Posicione a marca como referencia no assunto
- Hashtags de nicho e autoridade`,

    engajamento: `TIPO DE POST: Engajamento / Conexao
- Perguntas abertas para a audiencia
- Conteudo relatable e pessoal
- Incentive comentarios, compartilhamentos e saves
- Tom conversacional, proximo e autentico
- Crie conexao emocional com o publico
- Use storytelling quando apropriado`,
};

// =============================================================================
// IMAGE GENERATION
// =============================================================================

export interface ImageGenerationContext {
    brandName: string;
    visualStyle: string;
    caption: string;
    additionalContext?: string;
    imageStyle?: ImageStyleType;
    hasReferenceImages?: boolean;
    businessCategory?: string;
    postType?: PostType;
}

export type ImageStyleType = "realistic" | "illustrative" | "minimalist" | "artistic";

export interface ParsedImageInstructions {
    wantsWhiteBackground: boolean;
    wantsCleanBackground: boolean;
    backgroundInstruction: string | null;
    wantsTextOnImage: boolean;
    textInstruction: string | null;
    wantsMinimalist: boolean;
    wantsLifestyle: boolean;
    styleInstruction: string | null;
    wantsProductOnly: boolean;
    compositionInstruction: string | null;
    originalContext: string;
}

/**
 * Parses user's additionalContext to extract specific image generation instructions.
 * Supports Portuguese and English keywords.
 */
export function parseImageInstructions(additionalContext: string | undefined): ParsedImageInstructions {
    const ctx = (additionalContext || "").toLowerCase();
    
    // Background detection
    const whiteBackgroundPatterns = [
        /fundo\s*branco/i,
        /white\s*background/i,
        /fundo\s*limpo/i,
        /clean\s*background/i,
        /fundo\s*neutro/i,
        /neutral\s*background/i,
        /fundo\s*liso/i,
        /plain\s*background/i,
    ];
    
    const cleanBackgroundPatterns = [
        /sem\s*(fundo|background)/i,
        /fundo\s*simples/i,
        /simple\s*background/i,
        /fundo\s*unico/i,
        /solid\s*(background|color)/i,
    ];
    
    const wantsWhiteBackground = whiteBackgroundPatterns.some(p => p.test(ctx));
    const wantsCleanBackground = cleanBackgroundPatterns.some(p => p.test(ctx)) || wantsWhiteBackground;
    
    // Text detection
    const textPatterns = [
        /texto\s*(na|no|sobre)/i,
        /text\s*(on|in|over)/i,
        /com\s*texto/i,
        /with\s*text/i,
        /escrever/i,
        /write/i,
        /tipografia/i,
        /typography/i,
        /lettering/i,
        /frase\s*(na|no)/i,
        /phrase\s*(on|in)/i,
        /titulo/i,
        /title/i,
        /headline/i,
    ];
    
    const wantsTextOnImage = textPatterns.some(p => p.test(ctx));
    
    // Style detection
    const minimalistPatterns = [
        /minimalista/i,
        /minimalist/i,
        /minimal/i,
        /clean/i,
        /simples/i,
        /simple/i,
        /sem\s*elementos/i,
        /without\s*elements/i,
        /apenas\s*(o\s*)?(produto|pote|item)/i,
        /only\s*(the\s*)?(product|item)/i,
    ];
    
    const lifestylePatterns = [
        /lifestyle/i,
        /estilo\s*de\s*vida/i,
        /ambiente/i,
        /environment/i,
        /contexto/i,
        /context/i,
        /cena/i,
        /scene/i,
        /composicao\s*rica/i,
        /rich\s*composition/i,
    ];
    
    const wantsMinimalist = minimalistPatterns.some(p => p.test(ctx));
    const wantsLifestyle = lifestylePatterns.some(p => p.test(ctx)) && !wantsMinimalist && !wantsCleanBackground;
    
    // Product only detection
    const productOnlyPatterns = [
        /apenas\s*(o\s*)?(produto|pote|item|embalagem)/i,
        /only\s*(the\s*)?(product|item|package)/i,
        /so\s*(o\s*)?(produto|pote)/i,
        /just\s*(the\s*)?(product|item)/i,
        /foco\s*(no|em)\s*(produto|pote)/i,
        /focus\s*(on\s*)?(product|item)/i,
        /produto\s*isolado/i,
        /isolated\s*product/i,
    ];
    
    const wantsProductOnly = productOnlyPatterns.some(p => p.test(ctx));
    
    // Build specific instructions
    let backgroundInstruction: string | null = null;
    if (wantsWhiteBackground) {
        backgroundInstruction = "BACKGROUND: Pure white studio background (#FFFFFF). No props, no textures, no environmental elements. Clean, professional e-commerce style.";
    } else if (wantsCleanBackground) {
        backgroundInstruction = "BACKGROUND: Clean, solid-color background. Minimal distractions. Professional studio setting.";
    }
    
    let textInstruction: string | null = null;
    if (wantsTextOnImage) {
        textInstruction = "TEXT OVERLAY: Include promotional or informational text on the image as requested. Use clean, readable typography that complements the design.";
    }
    
    let styleInstruction: string | null = null;
    if (wantsMinimalist) {
        styleInstruction = "STYLE: Minimalist composition. Clean lines, ample negative space, focus on the product. No cluttered elements.";
    } else if (wantsLifestyle) {
        styleInstruction = "STYLE: Lifestyle photography with environmental context. Natural setting, props that tell a story.";
    }
    
    let compositionInstruction: string | null = null;
    if (wantsProductOnly) {
        compositionInstruction = "COMPOSITION: Product-only shot. Center the product. No additional props, decorations, or environmental elements.";
    }
    
    return {
        wantsWhiteBackground,
        wantsCleanBackground,
        backgroundInstruction,
        wantsTextOnImage,
        textInstruction,
        wantsMinimalist,
        wantsLifestyle,
        styleInstruction,
        wantsProductOnly,
        compositionInstruction,
        originalContext: additionalContext || "",
    };
}

export const IMAGE_GENERATION_PROMPT = (context: ImageGenerationContext) => {
    // Parse user instructions for smart overrides
    const parsed = parseImageInstructions(context.additionalContext);
    
    const referenceImagePrompt = context.hasReferenceImages
        ? `
## REFERENCE IMAGES (CRITICAL - HIGHEST PRIORITY)
The attached images show this brand's ACTUAL products. You MUST:
- PRESERVE the EXACT appearance of the product (packaging, label, colors, textures)
- DO NOT invent or change brand names, logos, or label text
- DO NOT modify the product design - reproduce it EXACTLY as shown
- Create a PHOTOREALISTIC photograph featuring this EXACT product
- The product in your generated image must be IDENTICAL to the reference
`
        : "";

    // Build user instructions section (highest priority)
    const userInstructionsSection = (parsed.backgroundInstruction || parsed.textInstruction || parsed.styleInstruction || parsed.compositionInstruction)
        ? `
## USER INSTRUCTIONS (MUST FOLLOW - HIGHEST PRIORITY)
The user specifically requested certain requirements. These OVERRIDE all default guidelines:

${parsed.backgroundInstruction || ""}
${parsed.textInstruction || ""}
${parsed.styleInstruction || ""}
${parsed.compositionInstruction || ""}

Original request: "${parsed.originalContext}"
`
        : parsed.originalContext 
            ? `
## USER INSTRUCTIONS
Additional context: "${parsed.originalContext}"
`
            : "";

    // Conditional text rule
    const textRule = parsed.wantsTextOnImage
        ? "- Include text/typography as requested by the user"
        : "- NO TEXT whatsoever - no words, letters, numbers, or typography (unless user specifically requested text)";

    // Conditional style guidance
    let styleGuidance: string;
    if (parsed.wantsWhiteBackground || parsed.wantsCleanBackground || parsed.wantsMinimalist || parsed.wantsProductOnly) {
        styleGuidance = `## STYLE GUIDANCE
- Clean, professional product photography
- ${parsed.wantsWhiteBackground ? "Pure white background as requested" : "Minimal, uncluttered background"}
- Sharp focus on the product
- Professional studio lighting (softbox or natural diffused light)
- ${parsed.wantsProductOnly ? "Product isolated, no additional elements" : "Minimal props only if they enhance the product"}
- E-commerce quality photography`;
    } else if (parsed.wantsLifestyle) {
        styleGuidance = `## STYLE GUIDANCE
- Lifestyle product photography with environmental context
- Natural, authentic setting that tells a story
- Props and elements that complement the product
- Warm, inviting atmosphere
- Instagram influencer or brand campaign style`;
    } else {
        styleGuidance = `## STYLE GUIDANCE
- Professional Instagram-ready product photography
- Natural, authentic feel - NOT overly edited or artificial looking
- Real textures, real materials, photorealistic lighting and shadows
- Products should look like actual physical products photographed professionally
- Balance between clean composition and visual interest`;
    }

    // Conditional forbidden list
    const forbiddenItems = [
        !parsed.wantsTextOnImage ? "NO TEXT of any kind in the image (user did not request text)" : null,
        "NO digital art, illustrations, or cartoon styles",
        "NO artificial or CGI-looking renders",
        "NO fantasy or surreal elements unless specifically requested",
        "NO stock photo watermarks or overlays",
        parsed.wantsWhiteBackground || parsed.wantsCleanBackground ? "NO lifestyle props, environmental elements, or cluttered backgrounds" : null,
    ].filter(Boolean);

    return `Create a PHOTOREALISTIC Instagram post image. This must look like a REAL PHOTOGRAPH taken with a professional camera.

${userInstructionsSection}

${referenceImagePrompt}

## PHOTOGRAPHY REQUIREMENTS
- Style: Professional product photography - MUST look like a real photo, NOT digital art
- Camera: Shot on Canon 5D Mark IV or similar professional DSLR
- Lens: 50mm f/1.8 or 85mm f/1.4 for natural perspective
- Lighting: ${parsed.wantsWhiteBackground ? "Clean studio softbox lighting, even illumination" : "Natural light or professional studio lighting"}
- Post-processing: Subtle color grading, realistic colors
- Quality: 8K resolution, sharp focus on subject

## IMAGE SPECIFICATIONS
- Resolution: 1200x1200px (Instagram square)
- Aspect ratio: 1:1
${textRule}

## BRAND CONTEXT
- Brand: ${context.brandName}
- Business Category: ${context.businessCategory || "Not specified"}
- Post Type: ${context.postType || "General content"}

## WHAT TO SHOW
Based on the caption context: "${context.caption}"

${styleGuidance}

## ABSOLUTELY FORBIDDEN
${forbiddenItems.map((item, i) => `${i + 1}. ${item}`).join("\n")}

Generate a photorealistic image now.`;
};
