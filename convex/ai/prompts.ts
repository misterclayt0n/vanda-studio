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
    brandVoice: {
        recommended: string;
        tone: string[];
    };
    targetAudience: string;
    contentPillars: Array<{
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
        : `## Nota
Este perfil ainda não possui posts analisados. Baseie-se inteiramente nas diretrizes da marca (voz, tom, público e pilares de conteúdo) para criar uma legenda que estabeleça a identidade da marca.`;

    return `Baseado no contexto da marca${hasAnalyzedPosts ? " e nos posts de sucesso analisados" : ""}, crie uma nova legenda para Instagram.

## Marca
- Voz: ${context.brandVoice.recommended}
- Tom: ${context.brandVoice.tone.join(", ")}
- Público: ${context.targetAudience}

## Pilares de Conteúdo
${context.contentPillars.map((p) => `- ${p.name}: ${p.description}`).join("\n")}

${postsSection}

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



export const IMAGE_GENERATION_PROMPT = (context: ImageGenerationContext) => {
    const styleSpec = context.imageStyle
        ? IMAGE_STYLE_SPECS[context.imageStyle]
        : IMAGE_STYLE_SPECS.realistic;

    // Build structured spec as JSON
    const imageSpec: ImageGenerationSpec = {
        project_constraints: {
            resolution: "1200x1200px",
            aspect_ratio: "1:1 (Instagram square)",
            output_quality: "High quality, 8K resolution rendering",
            text_overlay: "NO text in the image - clean visual only"
        },
        camera_and_style: {
            visual_aesthetic: styleSpec.visual_aesthetic || "Professional photography",
            perspective: styleSpec.perspective || "Eye-level, natural composition",
            post_processing: styleSpec.post_processing || {
                color_grading: "Natural, balanced",
                depth_of_field: "Shallow bokeh",
                lighting_style: "Soft natural light"
            }
        },
        subject_details: {
            main_subject: `Content for ${context.businessCategory || "brand"}: ${context.brandName}`,
            product_focus: context.businessCategory ? `Products/services related to ${context.businessCategory}` : undefined,
            brand_elements: context.hasReferenceImages ? "Match visual identity from reference images" : undefined
        },
        environment: {
            setting: context.postType === "promocao" 
                ? "Clean, product-focused setting that highlights the offering"
                : context.postType === "engajamento"
                ? "Warm, relatable environment that creates emotional connection"
                : "Professional, authoritative setting",
            mood: context.postType === "promocao"
                ? "Aspirational, desirable, premium feel"
                : context.postType === "engajamento"
                ? "Warm, authentic, inviting"
                : "Confident, trustworthy, expert",
            time_of_day: "Golden hour or well-lit studio"
        },
        lighting: {
            technique: "Professional studio/natural hybrid lighting",
            characteristics: "Soft shadows, highlight on main subject, balanced exposure"
        }
    };

    const referenceImagePrompt = context.hasReferenceImages
        ? `
## REFERENCE IMAGES (CRITICAL)
The attached images are previous posts from this brand. You MUST:
- Maintain visual consistency with the brand's established style
- Preserve exact appearance of products (packaging, logos, colors)
- Replicate the photographic style and composition
- If there's a specific product (jar, package, etc), include it with IDENTICAL appearance
`
        : "";

    return `Generate an Instagram post image using the following structured specification:

## IMAGE SPECIFICATION (JSON)
${JSON.stringify(imageSpec, null, 2)}

## BRAND CONTEXT
- Brand: ${context.brandName}
- Business Category: ${context.businessCategory || "Not specified"}
- Post Type: ${context.postType || "General"}

## POST CAPTION (for context)
"${context.caption}"

${context.additionalContext ? `## ADDITIONAL CONTEXT\n${context.additionalContext}` : ""}

${referenceImagePrompt}

## CRITICAL REQUIREMENTS
1. Follow the JSON specification precisely
2. NO text overlays in the image
3. The image must complement and enhance the caption's message
4. Create a scroll-stopping composition for Instagram feed
5. ${context.hasReferenceImages ? "MAINTAIN visual consistency with reference images - this is the highest priority" : "Create a fresh, professional visual"}

Generate the image now.`;
};

