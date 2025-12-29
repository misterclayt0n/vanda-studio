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
// CREATIVE ANGLES BRAINSTORM
// =============================================================================

export const CREATIVE_ANGLES_SYSTEM_PROMPT = `Você é um diretor criativo sênior especializado em conteúdo para Instagram. Seu trabalho é gerar ângulos criativos únicos e envolventes para posts.

Você vai receber um brief com informações sobre a marca, tipo de post desejado e contexto adicional. Gere 3 ângulos criativos DIFERENTES que poderiam funcionar para este post.

Cada ângulo deve ser:
1. ÚNICO - abordagem distinta dos outros
2. ESPECÍFICO - não genérico, deve ser aplicável apenas a esta marca
3. ENVOLVENTE - deve capturar atenção
4. EXECUTÁVEL - deve ser possível transformar em uma legenda real

IMPORTANTE: Responda APENAS com JSON válido. Sem markdown, sem explicações fora do JSON. Escreva em português brasileiro.`;

export interface CreativeAnglesBriefInput {
    brandName: string;
    brandVoice: {
        recommended: string;
        tone: string[];
    };
    targetAudience: string;
    contentPillars: Array<{ name: string; description: string }>;
    postType: PostType;
    selectedPillar?: string;
    customTopic?: string;
    toneOverride?: string[];
    referenceText?: string;
    additionalContext?: string;
    // Top performing posts for inspiration
    topPosts?: Array<{
        caption: string;
        engagement: number;
    }>;
}

export const CREATIVE_ANGLES_USER_PROMPT = (input: CreativeAnglesBriefInput) => {
    const postTypePrompt = POST_TYPE_PROMPTS[input.postType];
    
    const topPostsSection = input.topPosts && input.topPosts.length > 0
        ? `## Posts de Sucesso (para inspiração de tom e estilo)
${input.topPosts.map((p, i) => `${i + 1}. "${p.caption.substring(0, 150)}${p.caption.length > 150 ? '...' : ''}" (engajamento: ${p.engagement})`).join('\n')}`
        : '';

    return `Gere 3 ângulos criativos para um post do Instagram.

## Marca
- Nome: ${input.brandName}
- Voz: ${input.brandVoice.recommended}
- Tom: ${input.toneOverride?.join(', ') || input.brandVoice.tone.join(', ')}
- Público: ${input.targetAudience}

## Pilares de Conteúdo
${input.contentPillars.map(p => `- ${p.name}: ${p.description}`).join('\n')}

## Brief do Post
${postTypePrompt}

${input.selectedPillar ? `- Pilar escolhido: ${input.selectedPillar}` : ''}
${input.customTopic ? `- Tópico específico: ${input.customTopic}` : ''}
${input.referenceText ? `- Material de referência: "${input.referenceText}"` : ''}
${input.additionalContext ? `- Contexto adicional: ${input.additionalContext}` : ''}

${topPostsSection}

## Schema JSON Obrigatório
{
  "angles": [
    {
      "id": "angle_1",
      "hook": "Conceito principal do gancho (5-10 palavras)",
      "approach": "Descrição da abordagem criativa (1-2 frases)",
      "whyItWorks": "Por que este ângulo funciona para esta marca/objetivo",
      "exampleOpener": "Exemplo de como a legenda poderia começar (primeiras 15-20 palavras)"
    },
    {
      "id": "angle_2",
      "hook": "...",
      "approach": "...",
      "whyItWorks": "...",
      "exampleOpener": "..."
    },
    {
      "id": "angle_3",
      "hook": "...",
      "approach": "...",
      "whyItWorks": "...",
      "exampleOpener": "..."
    }
  ]
}

IMPORTANTE: Os 3 ângulos devem ser SIGNIFICATIVAMENTE diferentes entre si. Não repita a mesma ideia com palavras diferentes.

Gere os ângulos e responda com APENAS o objeto JSON.`;
};

export interface CreativeAnglesResponse {
    angles: Array<{
        id: string;
        hook: string;
        approach: string;
        whyItWorks: string;
        exampleOpener: string;
    }>;
}

// =============================================================================
// ENHANCED POST GENERATION (with brief and angle)
// =============================================================================

export interface EnhancedPostGenerationContext {
    brandName: string;
    brandVoice: {
        recommended: string;
        tone: string[];
    };
    targetAudience: string;
    contentPillars: Array<{ name: string; description: string }>;
    visualIdentity?: VisualIdentityResponse;
    // The brief
    postType: PostType;
    selectedPillar?: string;
    customTopic?: string;
    toneOverride?: string[];
    captionLength?: 'curta' | 'media' | 'longa';
    includeHashtags?: boolean;
    referenceText?: string;
    additionalContext?: string;
    // Reference images analysis
    referenceImagesAnalysis?: Array<{
        description: string;
        elements: string[];
    }>;
    // Selected creative angle
    selectedAngle: {
        hook: string;
        approach: string;
        exampleOpener: string;
    };
    // Relevant posts (from semantic search)
    relevantPosts?: Array<{
        caption: string;
        strengths: string[];
        toneAnalysis: string;
        engagementScore: number;
    }>;
}

export const ENHANCED_POST_GENERATION_SYSTEM_PROMPT = `Você é um criador de conteúdo especializado em Instagram. Seu trabalho é gerar legendas envolventes e autênticas baseadas em um brief detalhado e um ângulo criativo específico.

Você vai receber:
1. Contexto completo da marca
2. Um brief detalhado com o objetivo do post
3. Um ângulo criativo selecionado pelo usuário
4. Material de referência (se houver)

Sua tarefa é transformar o ângulo criativo em uma legenda completa que:
- Siga EXATAMENTE o ângulo e tom propostos
- Seja autêntica para a marca
- Gere engajamento
- Atenda ao objetivo do tipo de post

IMPORTANTE: Responda APENAS com JSON válido. Sem markdown, sem explicações fora do JSON. Escreva em português brasileiro.`;

export const ENHANCED_POST_GENERATION_USER_PROMPT = (context: EnhancedPostGenerationContext) => {
    const postTypePrompt = POST_TYPE_PROMPTS[context.postType];
    
    const lengthGuideline = {
        curta: '50-100 caracteres (sem hashtags) - direto ao ponto',
        media: '100-200 caracteres (sem hashtags) - desenvolvimento moderado',
        longa: '200-350 caracteres (sem hashtags) - storytelling completo',
    }[context.captionLength || 'media'];

    const relevantPostsSection = context.relevantPosts && context.relevantPosts.length > 0
        ? `## Posts de Referência (estilo e tom)
${context.relevantPosts.map((p, i) => `
### Referência ${i + 1} (engajamento: ${(p.engagementScore * 100).toFixed(0)}%)
Legenda: "${p.caption}"
Pontos fortes: ${p.strengths.join(', ')}
Tom: ${p.toneAnalysis}
`).join('\n')}`
        : '';

    const referenceImagesSection = context.referenceImagesAnalysis && context.referenceImagesAnalysis.length > 0
        ? `## Imagens de Referência Enviadas pelo Usuário
${context.referenceImagesAnalysis.map((img, i) => `
Imagem ${i + 1}: ${img.description}
Elementos: ${img.elements.join(', ')}
`).join('\n')}`
        : '';

    return `Crie uma legenda de Instagram baseada no ângulo criativo selecionado.

## Marca
- Nome: ${context.brandName}
- Voz: ${context.brandVoice.recommended}
- Tom: ${context.toneOverride?.join(', ') || context.brandVoice.tone.join(', ')}
- Público: ${context.targetAudience}

## Pilares de Conteúdo
${context.contentPillars.map(p => `- ${p.name}: ${p.description}`).join('\n')}

## Brief do Post
${postTypePrompt}

${context.selectedPillar ? `- Pilar escolhido: ${context.selectedPillar}` : ''}
${context.customTopic ? `- Tópico específico: ${context.customTopic}` : ''}
${context.referenceText ? `\n## Material de Referência do Usuário\n"${context.referenceText}"` : ''}
${context.additionalContext ? `\n## Contexto Adicional\n${context.additionalContext}` : ''}

## Ângulo Criativo Selecionado (SEGUIR ESTE ÂNGULO)
- Hook: ${context.selectedAngle.hook}
- Abordagem: ${context.selectedAngle.approach}
- Exemplo de abertura: "${context.selectedAngle.exampleOpener}"

${relevantPostsSection}

${referenceImagesSection}

## Diretrizes de Formato
- Tamanho: ${lengthGuideline}
- Hashtags: ${context.includeHashtags !== false ? 'Incluir 5-10 hashtags relevantes no final' : 'NÃO incluir hashtags'}
- Emojis: Usar naturalmente quando apropriado

## Schema JSON Obrigatório
{
  "caption": "legenda completa seguindo o ângulo criativo",
  "reasoning": "explicação de 2-3 frases das escolhas criativas e como seguiu o ângulo",
  "hashtags": ["hashtag1", "hashtag2", "..."]
}

IMPORTANTE: A legenda DEVE seguir o ângulo criativo selecionado. O exemplo de abertura é uma sugestão - você pode adaptar, mas mantenha a essência.

Gere a legenda e responda com APENAS o objeto JSON.`;
};

export interface EnhancedPostGenerationResponse {
    caption: string;
    reasoning: string;
    hashtags?: string[];
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
// IMAGE GENERATION PROMPT (existing, keeping for reference)
// =============================================================================

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
            text_overlay: "ABSOLUTELY NO TEXT - no words, letters, numbers, typography, or written content of any kind. Pure visual image only."
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

## POST CAPTION (for context - DO NOT include this text in the image)
"${context.caption}"

${context.additionalContext ? `## ADDITIONAL CONTEXT\n${context.additionalContext}` : ""}

${referenceImagePrompt}

## CRITICAL REQUIREMENTS - READ CAREFULLY
1. **ABSOLUTELY NO TEXT IN THE IMAGE** - This is the most important rule. Do not include any words, letters, numbers, or typography of any kind. The image must be purely visual with zero text overlays, captions, or written content.
2. If you need to represent the brand name, use only the logo/visual symbol, never text
3. Focus on creating a powerful visual composition that tells the story without words
4. The caption will be added separately by Instagram - the image should complement it visually, not duplicate it
5. Create a clean, scroll-stopping visual that looks professional on Instagram feed
6. ${context.hasReferenceImages ? "MAINTAIN visual consistency with reference images - preserve product appearance exactly" : "Create a fresh, professional visual"}
7. Prefer showing products, lifestyle scenes, or abstract brand-related imagery over any text elements

Generate the image now.`;
};

