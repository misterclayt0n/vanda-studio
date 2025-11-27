// Prompt templates for AI analysis (PT-BR)

export const BRAND_ANALYSIS_SYSTEM_PROMPT = `Você é um estrategista sênior de mídias sociais e consultor de marca especializado em marketing no Instagram. Seu papel é analisar perfis do Instagram e fornecer estratégias de transformação acionáveis.

Sua análise deve ser:
1. ACIONÁVEL - Cada recomendação deve ser implementável imediatamente
2. ESPECÍFICA - Referencie padrões reais que você observa nos dados
3. FUNDAMENTADA - Explique POR QUE cada mudança vai melhorar a performance
4. CONSTRUTIVA - Enquadre as melhorias de forma positiva sendo honesto

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

## Dados do Perfil
- Handle: @${data.handle}
- Bio: ${data.bio || "(sem bio)"}
- Seguidores: ${data.followersCount?.toLocaleString("pt-BR") || "desconhecido"}
- Total de Posts: ${data.postsCount || 0}
${data.profilePictureUrl ? `- Foto de Perfil: (imagem anexada)` : ""}

${postsSection}

## Schema JSON Obrigatório (responda em português brasileiro)
{
  "brandVoice": {
    "current": "${hasPosts ? "Descrição da voz atual da marca baseada nas legendas" : "Não há posts para analisar - descreva o que a bio e handle sugerem"}",
    "recommended": "Direção recomendada para a voz da marca",
    "reasoning": "Por que essa direção vai melhorar o engajamento",
    "tone": ["adjetivo1", "adjetivo2", "adjetivo3"]
  },
  "contentPillars": [
    {
      "name": "Nome do pilar",
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

Analise profundamente e responda com APENAS o objeto JSON.`;
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
}

// Image style types
export type ImageStyleType = "realistic" | "illustrative" | "minimalist" | "artistic";

export const IMAGE_STYLE_PROMPTS: Record<ImageStyleType, string> = {
    realistic: `ESTILO: Fotografia profissional hiper-realista
- Foto tirada com câmera DSLR profissional, lente 50mm f/1.8
- Iluminação natural suave, golden hour
- Profundidade de campo realista com bokeh natural
- Texturas e materiais autênticos, sem aparência artificial
- Cores naturais e saturação equilibrada
- SEM elementos de IA, SEM aparência digital ou renderizada
- Deve parecer uma foto real tirada por um fotógrafo profissional`,

    illustrative: `ESTILO: Ilustração digital moderna
- Arte digital colorida e vibrante
- Estilo de ilustração contemporânea para redes sociais
- Cores vivas e contrastantes
- Formas bem definidas e clean
- Pode incluir elementos gráficos e patterns
- Visual moderno e atraente para Instagram`,

    minimalist: `ESTILO: Minimalista e clean
- Design limpo com muito espaço em branco
- Paleta de cores reduzida (2-3 cores)
- Composição simples e elegante
- Foco em um único elemento principal
- Linhas simples e formas geométricas básicas
- Estética sofisticada e premium`,

    artistic: `ESTILO: Artístico e criativo
- Estilo artístico único e expressivo
- Pode incluir elementos abstratos
- Cores ousadas e combinações criativas
- Composição dinâmica e interessante
- Texturas e efeitos artísticos
- Visual impactante e memorável`,
};

export const IMAGE_GENERATION_PROMPT = (context: ImageGenerationContext) => {
    const stylePrompt = context.imageStyle
        ? IMAGE_STYLE_PROMPTS[context.imageStyle]
        : IMAGE_STYLE_PROMPTS.realistic;

    const referenceImagePrompt = context.hasReferenceImages
        ? `
IMAGENS DE REFERÊNCIA:
As imagens anexadas são posts anteriores desta marca. Use-as como referência visual para:
- Manter consistência visual com o estilo da marca
- Preservar a identidade de produtos (como embalagens, logos, cores)
- Replicar o estilo fotográfico e composição usados pela marca
- Se houver um produto específico nas imagens (como um pote, embalagem, etc), inclua-o na nova imagem com aparência IDÊNTICA
`
        : "";

    return `Crie uma imagem para um post do Instagram.

MARCA: ${context.brandName}
${referenceImagePrompt}
${stylePrompt}

LEGENDA DO POST:
"${context.caption}"

${context.additionalContext ? `CONTEXTO ADICIONAL: ${context.additionalContext}` : ""}

DIRETRIZES OBRIGATÓRIAS:
- Formato quadrado (1:1) otimizado para Instagram
- A imagem deve complementar a legenda e mensagem do post
- NÃO inclua texto na imagem
- Composição que chame atenção no feed
- Alta qualidade e resolução
${context.hasReferenceImages ? "- MANTENHA consistência visual com as imagens de referência\n- PRESERVE a aparência exata de produtos/embalagens mostrados" : ""}

Gere a imagem.`;
};

