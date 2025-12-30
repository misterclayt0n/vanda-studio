// Prompt templates for AI analysis (PT-BR)

export const BRAND_ANALYSIS_SYSTEM_PROMPT = `Você é um estrategista sênior de mídias sociais e consultor de marca especializado em marketing no Instagram. Seu papel é analisar perfis do Instagram e fornecer estratégias de transformação acionáveis.

REGRAS CRÍTICAS DE ANÁLISE:
1. ANALISE O CONTEÚDO REAL - Não interprete o nome/handle literalmente. Analise o que a marca REALMENTE vende/faz baseado nas legendas, bio e produtos mostrados
2. IDENTIFIQUE O NEGÓCIO - Determine a categoria de negócio real (ex: se vende mel, é "Alimentação/Produtos Naturais", não "Sustentabilidade Amazônica")
3. FOQUE NO PRODUTO/SERVIÇO - O que eles vendem? Qual o benefício para o cliente?
4. IGNORE NOMES BONITOS - "Amazonian Nectar" vendendo mel = empresa de mel/produtos naturais, não empresa sobre a Amazônia

Sua análise deve ser:
1. ACIONÁVEL - Cada recomendação deve ser implementável imediatamente
2. ESPECÍFICA - Referencie padrões reais que você observa nos dados
3. FUNDAMENTADA - Explique POR QUE cada mudança vai melhorar a performance
4. BASEADA NO PRODUTO - Foque no que a empresa vende, não no que o nome sugere

Você receberá dados do perfil e posts recentes. Analise-os de forma holística para entender o estado atual da marca e fornecer recomendações estratégicas.

IMPORTANTE: Responda APENAS com JSON válido seguindo exatamente o schema fornecido. Sem markdown, sem explicações fora do JSON. Escreva todo o conteúdo em português brasileiro.`;

export const BRAND_ANALYSIS_USER_PROMPT = (data: {
    handle: string;
    bio: string | undefined;
    followersCount: number | undefined;
    postsCount: number | undefined;
    posts: Array<{
        caption: string | undefined;
        likeCount: number | undefined;
        commentsCount: number | undefined;
        mediaType: string;
        timestamp: string;
    }>;
    profilePictureUrl?: string | undefined;
}) => {
    const hasPosts = data.posts.length > 0;

    const postsSection = hasPosts
        ? `## Posts Recentes (${data.posts.length} posts)
${data.posts.map((post, i) => `
### Post ${i + 1}
- Tipo: ${post.mediaType}
- Data: ${post.timestamp}
- Curtidas: ${post.likeCount ?? "desconhecido"}
- Comentários: ${post.commentsCount ?? "desconhecido"}
- Legenda: "${post.caption || "(sem legenda)"}"
`).join("\n")}`
        : `## Posts
Este perfil ainda não possui posts publicados. Baseie sua análise inteiramente no handle, bio e foto de perfil para inferir a identidade da marca e fornecer recomendações estratégicas para o início da presença digital.`;

    return `Analise este perfil do Instagram e forneça uma estratégia completa de transformação da marca.

ATENÇÃO: Analise o CONTEÚDO REAL dos posts para entender o que a empresa faz. NÃO interprete o nome/handle literalmente.

## Dados do Perfil
- Handle: @${data.handle}
- Bio: ${data.bio || "(sem bio)"}
- Seguidores: ${data.followersCount?.toLocaleString("pt-BR") || "desconhecido"}
- Total de Posts: ${data.postsCount || 0}
${data.profilePictureUrl ? `- Foto de Perfil: (imagem anexada)` : ""}

${postsSection}

## Schema JSON Obrigatório (responda em português brasileiro)
{
  "businessCategory": "Categoria real do negócio baseada no que VENDEM (ex: Mel e Produtos Naturais, Moda Feminina, Restaurante, etc)",
  "productOrService": "O que a empresa vende ou oferece especificamente",
  "brandVoice": {
    "current": "${hasPosts ? "Descrição da voz atual da marca baseada nas legendas" : "Não há posts para analisar - descreva o que a bio e handle sugerem"}",
    "recommended": "Direção recomendada para a voz da marca",
    "reasoning": "Por que essa direção vai melhorar o engajamento",
    "tone": ["adjetivo1", "adjetivo2", "adjetivo3"]
  },
  "contentPillars": [
    {
      "name": "Nome do pilar (focado no PRODUTO/SERVIÇO, não no nome da marca)",
      "description": "O que este pilar de conteúdo abrange",
      "reasoning": "Por que este pilar combina com a marca"
    }
  ],
  "visualDirection": {
    "currentStyle": "${hasPosts ? "Descrição do estilo visual atual" : "Sem posts para analisar - baseie-se na foto de perfil se disponível"}",
    "recommendedStyle": "Direção visual recomendada",
    "reasoning": "Por que essa mudança visual vai ajudar"
  },
  "targetAudience": {
    "current": "${hasPosts ? "Para quem o conteúdo atual atrai" : "Não há conteúdo - descreva o público sugerido pelo handle/bio"}",
    "recommended": "Público-alvo ideal",
    "reasoning": "Por que focar neste público faz sentido"
  },
  "overallScore": ${hasPosts ? "75" : "50"},
  "strategySummary": "Resumo de 2-3 frases das principais recomendações estratégicas"
}

LEMBRE-SE: Foque no que a empresa VENDE, não no que o nome sugere. Analise profundamente e responda com APENAS o objeto JSON.`;
};

export const POST_ANALYSIS_SYSTEM_PROMPT = `Você é um estrategista de conteúdo sênior revisando posts do Instagram como um revisor de código revisa pull requests. Seu trabalho é fornecer feedback específico e acionável sobre a legenda de cada post.

Para cada post, você vai:
1. Reescrever a legenda para maximizar o engajamento
2. Explicar seu raciocínio (como comentários de PR)
3. Dar uma nota para a legenda original (0-100)
4. Listar melhorias específicas por categoria

Seja específico. Referencie o conteúdo real. Explique seu raciocínio claramente.

IMPORTANTE: Responda APENAS com JSON válido seguindo exatamente o schema fornecido. Sem markdown, sem explicações fora do JSON. Escreva todo o conteúdo em português brasileiro.`;

export const POST_ANALYSIS_USER_PROMPT = (data: {
    brandContext: {
        handle: string;
        brandVoice: string;
        targetAudience: string;
        contentPillars: string[];
    };
    post: {
        caption: string | undefined;
        mediaType: string;
        likeCount: number | undefined;
        commentsCount: number | undefined;
        timestamp: string;
    };
}) => `Revise este post do Instagram e forneça feedback detalhado.

## Contexto da Marca
- Handle: @${data.brandContext.handle}
- Voz Alvo: ${data.brandContext.brandVoice}
- Público-Alvo: ${data.brandContext.targetAudience}
- Pilares de Conteúdo: ${data.brandContext.contentPillars.join(", ")}

## Post para Revisar
- Tipo: ${data.post.mediaType}
- Data: ${data.post.timestamp}
- Engajamento: ${data.post.likeCount ?? 0} curtidas, ${data.post.commentsCount ?? 0} comentários
- Legenda Atual: "${data.post.caption || "(sem legenda)"}"

## Schema JSON Obrigatório (responda em português brasileiro)
{
  "suggestedCaption": "A legenda reescrita que resolve todos os problemas e maximiza o engajamento",
  "reasoning": "2-3 frases explicando as principais mudanças e por que elas melhoram o post",
  "score": 65,
  "improvements": [
    {
      "type": "hook",
      "issue": "O que está errado com a abordagem atual",
      "suggestion": "Correção específica"
    },
    {
      "type": "cta",
      "issue": "Problema com a chamada para ação",
      "suggestion": "Melhor abordagem de CTA"
    }
  ]
}

Tipos de melhoria válidos: "hook" (gancho), "cta" (chamada para ação), "hashtags", "tone" (tom), "length" (tamanho), "emoji", "formatting" (formatação), "value" (valor)

Analise e responda com APENAS o objeto JSON.`;

// Types for parsed responses
export interface BrandAnalysisResponse {
    brandVoice: {
        current: string;
        recommended: string;
        reasoning: string;
        tone: string[];
    };
    contentPillars: Array<{
        name: string;
        description: string;
        reasoning: string;
    }>;
    visualDirection: {
        currentStyle: string;
        recommendedStyle: string;
        reasoning: string;
    };
    targetAudience: {
        current: string;
        recommended: string;
        reasoning: string;
    };
    overallScore: number;
    strategySummary: string;
}

export interface PostAnalysisResponse {
    suggestedCaption: string;
    reasoning: string;
    score: number;
    improvements: Array<{
        type: string;
        issue: string;
        suggestion: string;
    }>;
}

// New prompts for per-post analysis (Analisar button)
export const SINGLE_POST_ANALYSIS_SYSTEM_PROMPT = `Você é um estrategista de conteúdo sênior especializado em Instagram. Seu trabalho é fornecer uma análise detalhada de um único post, identificando pontos fortes, fracos e oportunidades de melhoria.

Sua análise deve ser:
1. DETALHADA - Examine cada aspecto do post
2. ESPECÍFICA - Referencie elementos concretos da legenda
3. CONSTRUTIVA - Identifique tanto pontos positivos quanto negativos
4. ACIONÁVEL - Forneça insights que possam ser aplicados

IMPORTANTE: Responda APENAS com JSON válido seguindo exatamente o schema fornecido. Sem markdown, sem explicações fora do JSON. Escreva todo o conteúdo em português brasileiro.`;

export const SINGLE_POST_ANALYSIS_USER_PROMPT = (data: {
    handle: string;
    brandVoice?: string;
    targetAudience?: string;
    post: {
        caption: string | undefined;
        mediaType: string;
        likeCount: number | undefined;
        commentsCount: number | undefined;
        timestamp: string;
    };
}) => `Analise este post do Instagram em profundidade.

## Contexto
- Perfil: @${data.handle}
${data.brandVoice ? `- Voz da Marca: ${data.brandVoice}` : ""}
${data.targetAudience ? `- Público-Alvo: ${data.targetAudience}` : ""}

## Post para Analisar
- Tipo: ${data.post.mediaType}
- Data: ${data.post.timestamp}
- Engajamento: ${data.post.likeCount ?? 0} curtidas, ${data.post.commentsCount ?? 0} comentários
- Legenda: "${data.post.caption || "(sem legenda)"}"

## Schema JSON Obrigatório
{
  "score": 75,
  "strengths": [
    "Ponto forte 1 específico",
    "Ponto forte 2 específico"
  ],
  "weaknesses": [
    "Ponto fraco 1 específico",
    "Ponto fraco 2 específico"
  ],
  "engagementPrediction": "Análise de como o post provavelmente performou e por quê",
  "hashtagAnalysis": "Análise das hashtags usadas (ou falta delas)",
  "toneAnalysis": "Análise do tom e voz da legenda",
  "reasoning": "Resumo geral de 2-3 frases sobre o post"
}

Analise e responda com APENAS o objeto JSON.`;

export interface SinglePostAnalysisResponse {
    score: number;
    strengths: string[];
    weaknesses: string[];
    engagementPrediction: string;
    hashtagAnalysis: string;
    toneAnalysis: string;
    reasoning: string;
}

// Post generation prompt - creates new posts based on learned context
export const POST_GENERATION_SYSTEM_PROMPT = `Você é um criador de conteúdo especializado em Instagram. Seu trabalho é gerar legendas envolventes e autênticas para posts do Instagram baseado no contexto da marca e em posts de sucesso analisados.

Sua legenda deve:
1. MANTER a voz e tom da marca
2. SEGUIR os padrões dos posts de sucesso
3. SER envolvente e gerar engajamento
4. INCLUIR emojis de forma natural quando apropriado
5. INCLUIR hashtags relevantes no final
6. TER entre 150-300 caracteres (sem contar hashtags)

IMPORTANTE: Responda APENAS com JSON válido seguindo exatamente o schema fornecido. Sem markdown, sem explicações fora do JSON. Escreva todo o conteúdo em português brasileiro.`;

export interface PostGenerationContext {
    brandVoice?: {
        recommended: string;
        tone: string[];
    };
    targetAudience?: string;
    contentPillars?: Array<{
        name: string;
        description: string;
    }>;
    analyzedPosts: Array<{
        caption: string;
        strengths: string[];
        toneAnalysis: string;
    }>;
    additionalContext?: string;
}

export const POST_GENERATION_USER_PROMPT = (context: PostGenerationContext) => {
    const hasAnalyzedPosts = context.analyzedPosts.length > 0;
    const hasBrandContext = context.brandVoice && context.targetAudience && context.contentPillars;

    const postsSection = hasAnalyzedPosts
        ? `## Posts Analisados (referência de estilo)
${context.analyzedPosts
    .map(
        (p) => `
Legenda: "${p.caption}"
Pontos fortes: ${p.strengths.join(", ")}
Tom: ${p.toneAnalysis}
`
    )
    .join("\n---\n")}`
        : "";

    const brandSection = hasBrandContext
        ? `## Marca
- Voz: ${context.brandVoice!.recommended}
- Tom: ${context.brandVoice!.tone.join(", ")}
- Público: ${context.targetAudience}

## Pilares de Conteúdo
${context.contentPillars!.map((p) => `- ${p.name}: ${p.description}`).join("\n")}`
        : "";

    const contextNote = !hasBrandContext && !hasAnalyzedPosts
        ? `## Nota
Nenhuma análise de marca ou posts foi encontrada. Crie uma legenda profissional e envolvente para Instagram baseada no contexto adicional fornecido.`
        : !hasBrandContext
            ? `## Nota
A análise de marca não está disponível. Use os posts analisados como referência de estilo.`
            : !hasAnalyzedPosts
                ? `## Nota
Nenhum post foi analisado. Baseie-se inteiramente nas diretrizes da marca.`
                : "";

    return `Crie uma nova legenda para Instagram${hasBrandContext ? " baseado no contexto da marca" : ""}${hasAnalyzedPosts ? " e nos posts de sucesso analisados" : ""}.

${brandSection}

${postsSection}

${contextNote}

${context.additionalContext ? `## Contexto Adicional do Usuário\n${context.additionalContext}` : ""}

## Schema JSON Obrigatório
{
  "caption": "legenda completa com emojis e hashtags",
  "reasoning": "explicação de 2-3 frases das escolhas criativas"
}

Gere uma legenda criativa e envolvente. Responda com APENAS o objeto JSON.`;
};

export interface PostGenerationResponse {
    caption: string;
    reasoning: string;
}

// Image generation prompt - creates images based on brand context and caption
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

// Image style types
export type ImageStyleType = "realistic" | "illustrative" | "minimalist" | "artistic";

// Structured JSON format for image generation (more precise control)
export interface ImageGenerationSpec {
    project_constraints: {
        resolution: string;
        aspect_ratio: string;
        output_quality: string;
        text_overlay: string;
    };
    camera_and_style: {
        visual_aesthetic: string;
        perspective: string;
        post_processing: {
            color_grading: string;
            depth_of_field: string;
            lighting_style: string;
        };
    };
    subject_details: {
        main_subject: string;
        product_focus?: string;
        brand_elements?: string;
    };
    environment: {
        setting: string;
        mood: string;
        time_of_day?: string;
    };
    lighting: {
        technique: string;
        characteristics: string;
    };
}

export const IMAGE_STYLE_SPECS: Record<ImageStyleType, Partial<ImageGenerationSpec["camera_and_style"]>> = {
    realistic: {
        visual_aesthetic: "Professional DSLR photography, hyper-realistic",
        perspective: "Eye-level, natural composition",
        post_processing: {
            color_grading: "Natural colors, balanced saturation",
            depth_of_field: "Shallow, f/1.8-2.8 bokeh",
            lighting_style: "Soft natural light, golden hour warmth"
        }
    },
    illustrative: {
        visual_aesthetic: "Modern digital illustration, vibrant",
        perspective: "Dynamic, contemporary social media style",
        post_processing: {
            color_grading: "Vivid, high contrast colors",
            depth_of_field: "Flat, graphic style",
            lighting_style: "Bold, defined shadows"
        }
    },
    minimalist: {
        visual_aesthetic: "Clean, minimal design",
        perspective: "Centered, symmetrical composition",
        post_processing: {
            color_grading: "Muted palette, 2-3 colors max",
            depth_of_field: "Infinite, everything in focus",
            lighting_style: "Even, soft, studio-like"
        }
    },
    artistic: {
        visual_aesthetic: "Expressive, creative, unique",
        perspective: "Dynamic, unconventional angles",
        post_processing: {
            color_grading: "Bold, creative color combinations",
            depth_of_field: "Variable, artistic blur effects",
            lighting_style: "Dramatic, high contrast"
        }
    }
};

// =============================================================================
// POST TYPE DEFINITIONS AND PROMPTS
// =============================================================================

export type PostType = "promocao" | "conteudo_profissional" | "engajamento";

export const POST_TYPE_LABELS: Record<PostType, string> = {
    promocao: "Promoção",
    conteudo_profissional: "Conteúdo Profissional",
    engajamento: "Engajamento",
};

export const POST_TYPE_PROMPTS: Record<PostType, string> = {
    promocao: `TIPO DE POST: Promocional / Vendas
- Foco em conversão e CTA claro e direto
- Destaque benefícios, ofertas e diferenciais
- Crie senso de urgência quando apropriado
- Use gatilhos mentais de escassez e exclusividade
- Hashtags focadas em vendas e nicho específico
- Tom persuasivo mas autêntico`,

    conteudo_profissional: `TIPO DE POST: Conteúdo Profissional / Autoridade
- Demonstre expertise e conhecimento no nicho
- Conteúdo informativo, educacional ou inspirador
- Tom confiante, profissional e acessível
- Agregue valor real para a audiência
- Posicione a marca como referência no assunto
- Hashtags de nicho e autoridade`,

    engajamento: `TIPO DE POST: Engajamento / Conexão
- Perguntas abertas para a audiência
- Conteúdo relatable e pessoal
- Incentive comentários, compartilhamentos e saves
- Tom conversacional, próximo e autêntico
- Crie conexão emocional com o público
- Use storytelling quando apropriado`,
};



// =============================================================================
// VISUAL IDENTITY EXTRACTION (Vision LLM)
// =============================================================================

export const VISUAL_IDENTITY_SYSTEM_PROMPT = `Você é um especialista em identidade visual e design. Sua tarefa é analisar imagens de posts do Instagram de uma marca e extrair sua identidade visual consistente.

Analise TODAS as imagens fornecidas em conjunto para identificar padrões visuais recorrentes.

IMPORTANTE: Responda APENAS com JSON válido. Sem markdown, sem explicações fora do JSON.`;

export const VISUAL_IDENTITY_USER_PROMPT = (brandName: string, numImages: number) => `Analise estas ${numImages} imagens de posts do Instagram da marca "${brandName}" e extraia a identidade visual.

## Schema JSON Obrigatório
{
  "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "dominantColors": ["cor1", "cor2", "cor3"],
  "layoutPatterns": ["padrao1", "padrao2"],
  "photographyStyle": "descrição do estilo fotográfico predominante",
  "graphicElements": ["elemento1", "elemento2"],
  "filterTreatment": "descrição do tratamento de cor/filtro usado",
  "consistencyScore": 75,
  "summary": "Resumo de 2-3 frases da identidade visual da marca"
}

Notas sobre os campos:
- colorPalette: 5 cores hexadecimais mais usadas
- dominantColors: nomes das cores dominantes em português
- layoutPatterns: padrões de composição (ex: "centralizado", "grid", "produto em destaque", "lifestyle")
- photographyStyle: estilo geral (ex: "produto em fundo clean", "lifestyle aspiracional", "flat lay")
- graphicElements: elementos gráficos recorrentes (ex: "logo no canto", "bordas", "texto sobreposto")
- filterTreatment: tratamento de cor (ex: "tons quentes", "alto contraste", "pastel", "saturado")
- consistencyScore: 0-100 indicando quão consistente é o visual entre posts

Analise as imagens e responda com APENAS o objeto JSON.`;

export interface VisualIdentityResponse {
    colorPalette: string[];
    dominantColors: string[];
    layoutPatterns: string[];
    photographyStyle: string;
    graphicElements: string[];
    filterTreatment: string;
    consistencyScore: number;
    summary?: string;
}



// =============================================================================
// REFERENCE IMAGE ANALYSIS (Vision LLM)
// =============================================================================

export const REFERENCE_IMAGE_ANALYSIS_SYSTEM_PROMPT = `Você é um especialista em análise visual. Sua tarefa é descrever imagens enviadas pelo usuário para uso como referência na geração de conteúdo.

Foque em:
1. O que está na imagem (objetos, produtos, pessoas, cenário)
2. O estilo visual (cores, composição, mood)
3. Elementos que podem ser reproduzidos ou referenciados

IMPORTANTE: Responda APENAS com JSON válido. Sem markdown, sem explicações fora do JSON.`;

export const REFERENCE_IMAGE_ANALYSIS_USER_PROMPT = `Analise esta imagem que será usada como referência para geração de conteúdo.

## Schema JSON Obrigatório
{
  "description": "Descrição detalhada do que está na imagem (2-3 frases)",
  "dominantColors": ["cor1", "cor2", "cor3"],
  "style": "Estilo visual geral (ex: minimalista, vibrante, profissional)",
  "mood": "Mood/atmosfera da imagem (ex: acolhedor, luxuoso, divertido)",
  "elements": ["elemento1", "elemento2", "elemento3"]
}

Analise a imagem e responda com APENAS o objeto JSON.`;

export interface ReferenceImageAnalysisResponse {
    description: string;
    dominantColors: string[];
    style: string;
    mood: string;
    elements: string[];
}

// =============================================================================
// SMART INSTRUCTION PARSER FOR IMAGE GENERATION
// =============================================================================

export interface ParsedImageInstructions {
    // Background
    wantsWhiteBackground: boolean;
    wantsCleanBackground: boolean;
    backgroundInstruction: string | null;
    
    // Text
    wantsTextOnImage: boolean;
    textInstruction: string | null;
    
    // Style
    wantsMinimalist: boolean;
    wantsLifestyle: boolean;
    styleInstruction: string | null;
    
    // Composition
    wantsProductOnly: boolean;
    compositionInstruction: string | null;
    
    // Original context preserved
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

// =============================================================================
// IMAGE GENERATION PROMPT (existing, keeping for reference)
// =============================================================================

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

