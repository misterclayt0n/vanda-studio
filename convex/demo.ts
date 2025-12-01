"use node";

import { ApifyClient } from "apify-client";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { callLLM, parseJSONResponse, generateImage, MODELS } from "./ai/llm";
import {
    PostGenerationResponse,
    BRAND_ANALYSIS_SYSTEM_PROMPT,
    BRAND_ANALYSIS_USER_PROMPT,
    PostType,
    POST_TYPE_LABELS,
} from "./ai/prompts";

// =============================================================================
// LOGGING UTILITY
// =============================================================================

interface LogStep {
    step: number;
    name: string;
    status: "started" | "completed" | "failed" | "skipped";
    duration?: number;
    details?: string;
    error?: string;
}

class DemoLogger {
    private steps: LogStep[] = [];
    private stepCounter = 0;
    private currentStepStart?: number;

    startStep(name: string, details?: string): number {
        this.stepCounter++;
        this.currentStepStart = Date.now();
        const step: LogStep = {
            step: this.stepCounter,
            name,
            status: "started",
            details,
        };
        this.steps.push(step);
        console.log(`[DEMO STEP ${this.stepCounter}] START: ${name}${details ? ` - ${details}` : ""}`);
        return this.stepCounter;
    }

    completeStep(stepNum: number, details?: string): void {
        const step = this.steps.find((s) => s.step === stepNum);
        if (step) {
            step.status = "completed";
            step.duration = this.currentStepStart ? Date.now() - this.currentStepStart : undefined;
            if (details) step.details = details;
            console.log(`[DEMO STEP ${stepNum}] COMPLETE: ${step.name} (${step.duration}ms)${details ? ` - ${details}` : ""}`);
        }
    }

    failStep(stepNum: number, error: string): void {
        const step = this.steps.find((s) => s.step === stepNum);
        if (step) {
            step.status = "failed";
            step.duration = this.currentStepStart ? Date.now() - this.currentStepStart : undefined;
            step.error = error;
            console.error(`[DEMO STEP ${stepNum}] FAILED: ${step.name} - ${error}`);
        }
    }

    getSummary(): string {
        const completed = this.steps.filter((s) => s.status === "completed").length;
        const failed = this.steps.filter((s) => s.status === "failed").length;
        const totalTime = this.steps.reduce((sum, s) => sum + (s.duration || 0), 0);
        return `Demo completed: ${completed}/${this.steps.length} steps (${failed} failed) in ${totalTime}ms`;
    }
}

const DEFAULT_ACTOR_ID = "shu8hvrXbJbY3Eb9W";

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type RawInstagramItem = Record<string, any>;

interface DemoPost {
    caption: string;
    mediaUrl: string;
    likeCount?: number;
    commentsCount?: number;
    timestamp: string;
    mediaType: string;
}

interface DemoResult {
    success: boolean;
    generatedCaption: string;
    generatedImageBase64?: string;
    generatedImageMimeType?: string;
    reasoning: string;
    sourcePosts: DemoPost[];
    brandAnalysis?: {
        brandVoice: string;
        targetAudience: string;
        contentPillars: string[];
    };
    error?: string;
    hasLimitedContext?: boolean;
    creativeAngle?: string;
}

// =============================================================================
// STEP 1: CREATIVE ANGLE BRAINSTORMING
// This is the KEY differentiator - we first brainstorm a unique angle
// =============================================================================

const CREATIVE_ANGLE_SYSTEM_PROMPT = `Você é um diretor criativo de uma agência de publicidade premiada. Sua especialidade é encontrar ÂNGULOS ÚNICOS e INESPERADOS para posts de Instagram.

Você NÃO escreve posts genéricos. Você encontra o ângulo que faz as pessoas PARAREM de scrollar.

Regras:
1. NUNCA use clichês ou fatos óbvios que qualquer um pode googlar
2. SEMPRE busque o ângulo inesperado, a conexão surpreendente
3. Pense como um criativo de Cannes - qual seria o twist?
4. O ângulo deve ser ESPECÍFICO para esta marca, não genérico

Responda APENAS com JSON válido.`;

const buildCreativeAnglePrompt = (
    postType: PostType,
    brandAnalysis: {
        businessCategory?: string;
        productOrService?: string;
        brandVoice: { current: string; recommended: string; tone: string[] };
        contentPillars: Array<{ name: string; description: string }>;
        targetAudience: { current: string; recommended: string };
    },
    posts: DemoPost[]
): string => {
    const topPosts = posts.slice(0, 5).map((p, i) => `${i + 1}. "${p.caption}"`).join("\n");
    
    const angleExamples: Record<PostType, string> = {
        promocao: `EXEMPLOS DE ÂNGULOS PROMOCIONAIS CRIATIVOS:
- Ao invés de "Nosso mel é puro": "O mel que sua avó compraria se ela tivesse Instagram"
- Ao invés de "Compre agora": "Por que pessoas que acordam às 5h escolhem este produto"
- Ao invés de "Qualidade premium": "O único [produto] que passou no teste do [pessoa/situação específica]"
- Ao invés de desconto genérico: "Última chance antes de [evento específico/temporada]"
- Conecte com momento cultural atual, tendência ou meme relevante`,

        conteudo_profissional: `EXEMPLOS DE ÂNGULOS DE AUTORIDADE CRIATIVOS:
- Ao invés de "Benefícios do mel": "O que apicultores nunca contam sobre mel de supermercado"
- Ao invés de "Dicas de uso": "3 erros que até nutricionistas cometem com [produto]"
- Ao invés de fatos genéricos: "A ciência por trás de por que [fato contraintuitivo]"
- Ao invés de "somos especialistas": Conte uma história de bastidores única
- Revele um segredo da indústria que gera curiosidade`,

        engajamento: `EXEMPLOS DE ÂNGULOS DE ENGAJAMENTO CRIATIVOS:
- Ao invés de "Você sabia?": "Qual celebridade você acha que consome mais mel? (A resposta vai te surpreender)"
- Ao invés de "Comente sua opinião": "Time mel no café vs Time mel no chá - isso pode acabar amizades 😂"
- Ao invés de pergunta genérica: "Se seu mel pudesse falar, o que ele diria sobre sua geladeira?"
- Crie polêmicas saudáveis do nicho: "Mel cristalizado: jogue fora ou é assim mesmo? O debate que divide famílias"
- Use formato de lista viral: "5 sinais de que você é viciado em [produto] (o 3 é pesado)"`,
    };

    return `## MARCA
- Negócio: ${brandAnalysis.businessCategory || "Não identificado"}
- Produto/Serviço: ${brandAnalysis.productOrService || "Não identificado"}
- Público: ${brandAnalysis.targetAudience.recommended}
- Tom da marca: ${brandAnalysis.brandVoice.tone.join(", ")}

## POSTS ANTERIORES DA MARCA
${topPosts || "Sem posts anteriores"}

## TIPO DE POST DESEJADO: ${POST_TYPE_LABELS[postType].toUpperCase()}

${angleExamples[postType]}

## SUA TAREFA
Baseado na marca acima, crie 3 ângulos criativos ÚNICOS e ESPECÍFICOS para um post de ${POST_TYPE_LABELS[postType].toLowerCase()}.

Os ângulos devem:
1. Ser IMPOSSÍVEIS de usar para outra marca (específicos demais)
2. Fazer a pessoa parar de scrollar
3. Ter um "twist" ou elemento inesperado
4. Respeitar o tom da marca

## FORMATO DE RESPOSTA (JSON)
{
  "angles": [
    {
      "angle": "Descrição do ângulo criativo em 1-2 frases",
      "hook": "As primeiras palavras que fariam alguém parar de scrollar",
      "why_it_works": "Por que esse ângulo é efetivo para esta marca específica"
    },
    {
      "angle": "...",
      "hook": "...",
      "why_it_works": "..."
    },
    {
      "angle": "...",
      "hook": "...", 
      "why_it_works": "..."
    }
  ],
  "recommended": 0
}

O campo "recommended" é o índice (0, 1 ou 2) do ângulo que você mais recomenda.

Seja OUSADO. Seja ESPECÍFICO. Seja MEMORÁVEL.`;
};

// =============================================================================
// STEP 2: CAPTION GENERATION (using the chosen creative angle)
// =============================================================================

const CAPTION_SYSTEM_PROMPT = `Você é um copywriter sênior especializado em Instagram. Você recebe um ÂNGULO CRIATIVO já definido e sua tarefa é transformá-lo em uma legenda IRRESISTÍVEL.

Você domina:
- Copywriting persuasivo
- Estrutura de posts virais
- Uso estratégico de emojis
- Hashtags que performam

Sua legenda deve:
1. COMEÇAR com o hook do ângulo criativo (as primeiras palavras são TUDO)
2. Desenvolver o ângulo de forma envolvente
3. Ter quebras de linha estratégicas para facilitar leitura
4. Terminar com CTA ou pergunta (dependendo do tipo de post)
5. Usar emojis de forma ESTRATÉGICA (não decorativa)
6. Incluir 5-8 hashtags relevantes e específicas

IMPORTANTE: A legenda deve parecer escrita por um HUMANO criativo, não por uma IA genérica.

Responda APENAS com JSON válido.`;

const buildCaptionPrompt = (
    postType: PostType,
    creativeAngle: { angle: string; hook: string; why_it_works: string },
    brandAnalysis: {
        businessCategory?: string;
        productOrService?: string;
        brandVoice: { current: string; recommended: string; tone: string[] };
        targetAudience: { current: string; recommended: string };
    }
): string => {
    const typeGuidelines: Record<PostType, string> = {
        promocao: `DIRETRIZES PARA POST PROMOCIONAL:
- Destaque o BENEFÍCIO principal, não características
- Crie senso de urgência ou escassez se fizer sentido
- CTA claro e direto (mas não desesperado)
- Pode mencionar preço/oferta se relevante
- Hashtags: mix de nicho + venda`,

        conteudo_profissional: `DIRETRIZES PARA POST DE AUTORIDADE:
- Entregue VALOR real (a pessoa deve aprender algo)
- Use dados ou fatos específicos quando possível
- Tom de quem sabe do que fala (sem arrogância)
- CTA para salvar/compartilhar
- Hashtags: nicho + autoridade + educacional`,

        engajamento: `DIRETRIZES PARA POST DE ENGAJAMENTO:
- A pergunta/interação deve ser FÁCIL de responder
- Crie identificação (a pessoa pensa "isso sou eu!")
- Pode ser polêmico/divertido (de forma saudável)
- CTA: perguntas que geram comentários
- Hashtags: mix de nicho + virais/tendência`,
    };

    return `## ÂNGULO CRIATIVO DEFINIDO
Hook: "${creativeAngle.hook}"
Ângulo: ${creativeAngle.angle}
Por que funciona: ${creativeAngle.why_it_works}

## MARCA
- Negócio: ${brandAnalysis.businessCategory || "Não identificado"}
- Produto: ${brandAnalysis.productOrService || "Não identificado"}
- Tom: ${brandAnalysis.brandVoice.tone.join(", ")}
- Público: ${brandAnalysis.targetAudience.recommended}

## TIPO: ${POST_TYPE_LABELS[postType].toUpperCase()}
${typeGuidelines[postType]}

## SUA TAREFA
Transforme o ângulo criativo acima em uma legenda completa para Instagram.

A legenda DEVE:
1. Começar EXATAMENTE com o hook ou uma variação muito próxima
2. Ter entre 150-300 palavras (sem contar hashtags)
3. Usar quebras de linha para facilitar leitura mobile
4. Incluir 5-8 hashtags específicas no final

## FORMATO DE RESPOSTA (JSON)
{
  "caption": "legenda completa com emojis e hashtags",
  "reasoning": "explicação breve de como você desenvolveu o ângulo"
}`;
};

// =============================================================================
// STEP 3: IMAGE GENERATION (post-type specific templates with TEXT BAKED IN)
// =============================================================================

const buildImagePrompt = (
    brandName: string,
    caption: string,
    creativeAngle: string,
    brandAnalysis: {
        businessCategory?: string;
        productOrService?: string;
    },
    hasReferenceImages: boolean,
    hasProfilePic: boolean,
    postType: PostType
): string => {
    // Extract the HOOK/HEADLINE from caption (first meaningful line, cleaned up)
    const captionLines = caption.split('\n').filter(line => line.trim().length > 0);
    const rawHeadline = captionLines[0] || creativeAngle;
    // Clean up: remove hashtags, emojis at start, limit length
    const headline = rawHeadline
        .replace(/#\w+/g, '')
        .replace(/^[\s\p{Emoji}]+/gu, '')
        .trim()
        .substring(0, 80);
    
    // Extract a secondary line if available
    const subheadline = captionLines[1]
        ? captionLines[1].replace(/#\w+/g, '').replace(/^[\s\p{Emoji}]+/gu, '').trim().substring(0, 100)
        : "";
    
    // POST TYPE SPECIFIC TEMPLATES - ALL WITH TEXT BAKED INTO THE IMAGE
    const templateByPostType: Record<PostType, string> = {
        // PROMOCAO: Product-focused with subtle text overlay
        promocao: `## LAYOUT: POST PROMOCIONAL

ESTILO VISUAL: Fotografia realista de produto, qualidade de smartphone de alta gama (não perfeita demais, autêntica)

COMPOSIÇÃO:
- Produto REAL em destaque (mesmo produto das referências)
- Fundo lifestyle mas não poluído
- Iluminação natural, não muito produzida

TEXTO NA IMAGEM:
- Pequeno badge ou tag com texto de oferta/CTA se apropriado
- Texto mínimo, foco no produto
- Fonte moderna e legível

${hasReferenceImages ? `CRÍTICO: O produto deve ser IDÊNTICO ao das imagens de referência - mesma embalagem, cor, formato.` : ""}`,

        // CONTEUDO PROFISSIONAL: Split layout with TEXT ON LEFT, IMAGE ON RIGHT
        conteudo_profissional: `## LAYOUT: POST EDUCATIVO/CONTEUDISTA

ESTILO VISUAL: Design gráfico profissional com foto realista integrada

LAYOUT OBRIGATÓRIO (dividido verticalmente):
┌─────────────────────────────────┐
│ ${hasProfilePic ? "LOGO (foto perfil)" : "@" + brandName} │ ← TOPO: header com marca
├────────────────┬────────────────┤
│                │                │
│  **TEXTO**     │   **FOTO**     │
│                │                │
│  Headline:     │   Imagem       │
│  "${headline.substring(0, 40)}${headline.length > 40 ? "..." : ""}"  │   realista     │
│                │   relacionada  │
│  ${subheadline ? `Sub: "${subheadline.substring(0, 30)}..."` : ""} │   ao negócio   │
│                │                │
└────────────────┴────────────────┘

LADO ESQUERDO (50%):
- Fundo em COR SÓLIDA da marca (extrair das referências)
- TEXTO ESCRITO NA IMAGEM:
  * Headline principal em fonte BOLD, grande
  * Subheadline menor se houver
  * Fonte: sans-serif moderna, legível
  * Cor do texto: contraste com fundo (branco ou escuro)
- Pode ter ícones ou elementos gráficos sutis

LADO DIREITO (50%):
- FOTOGRAFIA REALISTA relacionada ao negócio
- Estilo de foto de celular, não stock photo perfeita
- Produto ou cena do dia-a-dia do negócio

TOPO:
${hasProfilePic ? "- Incluir a foto de perfil (primeira imagem anexada) como LOGO pequeno no canto superior" : "- Texto @" + brandName + " no topo"}`,

        // ENGAJAMENTO: Bold text + emotional image
        engajamento: `## LAYOUT: POST DE ENGAJAMENTO

ESTILO VISUAL: Design chamativo com foto emocional/relatable

LAYOUT OBRIGATÓRIO:
┌─────────────────────────────────┐
│ ${hasProfilePic ? "LOGO (foto perfil)" : "@" + brandName} │ ← TOPO: header com marca
├────────────────┬────────────────┤
│                │                │
│  **PERGUNTA/   │   **FOTO**     │
│   HOOK**       │                │
│                │   Imagem       │
│  "${headline.substring(0, 40)}${headline.length > 40 ? "..." : ""}"  │   que gere     │
│                │   identificação│
│  ${subheadline ? `"${subheadline.substring(0, 30)}..."` : ""} │                │
│                │                │
└────────────────┴────────────────┘

LADO ESQUERDO (50%):
- Fundo em COR VIBRANTE (pode ser da marca ou complementar)
- TEXTO GRANDE E BOLD escrito na imagem:
  * A pergunta ou hook principal
  * Fonte impactante, fácil de ler
  * Pode incluir EMOJIS no texto
- Estilo: chamativo, parada de scroll

LADO DIREITO (50%):
- FOTO REALISTA e RELATABLE
- Pessoas reais, expressões autênticas
- Situação do cotidiano
- NÃO pode parecer stock photo

TOPO:
${hasProfilePic ? "- Logo da marca (foto de perfil) no canto superior" : "- @" + brandName}`,
    };

    const referenceInstructions = hasReferenceImages
        ? `
## IMAGENS DE REFERÊNCIA ANEXADAS
${hasProfilePic ? "- PRIMEIRA imagem = foto de perfil/logo da marca → USE no topo do design" : ""}
- Demais imagens = posts anteriores da marca
- EXTRAIA as cores da marca dessas imagens
- MANTENHA consistência visual
- O produto deve ser IGUAL ao das referências`
        : "";

    return `## TAREFA
Gerar imagem COMPLETA para Instagram - tipo: ${POST_TYPE_LABELS[postType]}

## MARCA
@${brandName}
Categoria: ${brandAnalysis.businessCategory || "Não especificada"}
Produto: ${brandAnalysis.productOrService || "Não especificado"}

## TEXTO QUE DEVE APARECER NA IMAGEM
Headline: "${headline}"
${subheadline ? `Subheadline: "${subheadline}"` : ""}

${templateByPostType[postType]}

${referenceInstructions}

## ESPECIFICAÇÕES
- Formato: 1:1 (quadrado Instagram)
- TEXTO DEVE ESTAR RENDERIZADO NA IMAGEM (não é placeholder)
- Estilo: Realista, autêntico (não muito polido/artificial)
- Qualidade: boa mas não perfeita (estilo conteúdo real de Instagram)

## REGRAS CRÍTICAS
1. O TEXTO deve estar ESCRITO na imagem final, legível e bem posicionado
2. A foto deve ser REALISTA, não ilustração nem render 3D perfeito
3. Layout EXATAMENTE como especificado acima
4. Cores extraídas das imagens de referência

Gere a imagem completa agora.`;
};

// =============================================================================
// MAIN DEMO ACTION
// =============================================================================

export const generateDemo = action({
    args: {
        instagramHandle: v.string(),
        additionalContext: v.optional(v.string()),
        postType: v.optional(v.union(
            v.literal("promocao"),
            v.literal("conteudo_profissional"),
            v.literal("engajamento")
        )),
        imageStyle: v.optional(v.union(
            v.literal("realistic"),
            v.literal("illustrative"),
            v.literal("minimalist"),
            v.literal("artistic")
        )),
        fingerprint: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<DemoResult> => {
        const logger = new DemoLogger();
        const postType: PostType = args.postType ?? "promocao";
        
        console.log("=".repeat(60));
        console.log(`[DEMO] Starting demo generation for @${args.instagramHandle}`);
        console.log(`[DEMO] Post type: ${POST_TYPE_LABELS[postType]}`);
        console.log("=".repeat(60));

        // Check if user is authenticated
        const identity = await ctx.auth.getUserIdentity();
        const isAuthenticated = !!identity;

        // Rate limit anonymous users
        if (!isAuthenticated && args.fingerprint) {
            const usage = await ctx.runQuery(api.demoUsage.checkDemoUsage, {
                fingerprint: args.fingerprint,
            });

            if (!usage.canUse) {
                return {
                    success: false,
                    generatedCaption: "",
                    reasoning: "",
                    sourcePosts: [],
                    error: "Voce ja usou sua demonstracao gratuita. Crie uma conta para continuar!",
                };
            }
        }

        const token = process.env.APIFY_API_TOKEN ?? process.env.APIFY_TOKEN;
        if (!token) {
            return {
                success: false,
                generatedCaption: "",
                reasoning: "",
                sourcePosts: [],
                error: "Servico de busca indisponivel no momento.",
            };
        }

        // Normalize handle
        let handle = args.instagramHandle.trim();
        if (handle.startsWith("@")) {
            handle = handle.slice(1);
        }
        if (handle.includes("instagram.com/")) {
            const match = handle.match(/instagram\.com\/([^/?]+)/);
            if (match) {
                handle = match[1];
            }
        }

        const instagramUrl = `https://www.instagram.com/${handle}/`;
        const client = new ApifyClient({ token });
        const actorId = process.env.APIFY_INSTAGRAM_ACTOR_ID ?? DEFAULT_ACTOR_ID;

        try {
            // =================================================================
            // STEP 1: Scrape target Instagram account (12 posts)
            // =================================================================
            const step1 = logger.startStep("Scrape target account", `@${handle}`);
            
            const run = await client.actor(actorId).call({
                directUrls: [instagramUrl],
                resultsType: "posts",
                resultsLimit: 12,
                addParentData: true,
                searchType: "user",
            });

            if (!run.defaultDatasetId) {
                logger.failStep(step1, "No dataset returned from Apify");
                return {
                    success: false,
                    generatedCaption: "",
                    reasoning: "",
                    sourcePosts: [],
                    error: "Nao foi possivel acessar o perfil. Verifique se o @ esta correto.",
                };
            }

            const { items } = await client.dataset(run.defaultDatasetId).listItems({ clean: true });
            const datasetItems = (items as RawInstagramItem[]) ?? [];

            if (datasetItems.length === 0) {
                logger.failStep(step1, "Profile not found");
                return {
                    success: false,
                    generatedCaption: "",
                    reasoning: "",
                    sourcePosts: [],
                    error: "Perfil nao encontrado. Verifique se o @ esta correto.",
                };
            }

            const allPosts = extractPosts(datasetItems);
            const hasLimitedContext = allPosts.length < 5;
            const profileData = extractProfileData(datasetItems, handle);
            
            logger.completeStep(step1, `Found ${allPosts.length} posts, ${profileData.followersCount ?? 0} followers`);

            // =================================================================
            // STEP 2: Generate brand analysis
            // =================================================================
            const step2 = logger.startStep("Analyze brand");
            
            const brandAnalysisPrompt = BRAND_ANALYSIS_USER_PROMPT({
                handle,
                bio: profileData.bio,
                followersCount: profileData.followersCount,
                postsCount: profileData.postsCount,
                posts: allPosts.map((p) => ({
                    caption: p.caption,
                    likeCount: p.likeCount,
                    commentsCount: p.commentsCount,
                    mediaType: p.mediaType,
                    timestamp: p.timestamp,
                })),
            });

            const brandResponse = await callLLM(
                [
                    { role: "system", content: BRAND_ANALYSIS_SYSTEM_PROMPT },
                    { role: "user", content: brandAnalysisPrompt },
                ],
                {
                    model: MODELS.GEMINI_2_5_FLASH,
                    temperature: 0.7,
                    maxTokens: 2048,
                    jsonMode: true,
                }
            );

            const brandAnalysis = parseJSONResponse<{
                businessCategory?: string;
                productOrService?: string;
                brandVoice: { current: string; recommended: string; tone: string[] };
                contentPillars: Array<{ name: string; description: string }>;
                targetAudience: { current: string; recommended: string };
            }>(brandResponse.content);

            console.log(`[DEMO] Business: ${brandAnalysis.businessCategory || "?"} | Product: ${brandAnalysis.productOrService || "?"}`);
            
            logger.completeStep(step2, `${brandAnalysis.businessCategory || "Brand analyzed"}`);

            // =================================================================
            // STEP 3: Brainstorm creative angles (THE KEY STEP!)
            // =================================================================
            const step3 = logger.startStep("Brainstorm creative angles", POST_TYPE_LABELS[postType]);
            
            const creativeAnglePrompt = buildCreativeAnglePrompt(postType, brandAnalysis, allPosts);
            
            const angleResponse = await callLLM(
                [
                    { role: "system", content: CREATIVE_ANGLE_SYSTEM_PROMPT },
                    { role: "user", content: creativeAnglePrompt },
                ],
                {
                    model: MODELS.GPT_4_1,
                    temperature: 0.9, // High creativity
                    maxTokens: 1024,
                }
            );

            const angleResult = parseJSONResponse<{
                angles: Array<{ angle: string; hook: string; why_it_works: string }>;
                recommended: number;
            }>(angleResponse.content);

            const chosenAngle = angleResult.angles[angleResult.recommended] || angleResult.angles[0];
            
            console.log(`[DEMO] Creative angle: "${chosenAngle.hook}"`);
            logger.completeStep(step3, `"${chosenAngle.hook.substring(0, 50)}..."`);

            // =================================================================
            // STEP 4: Generate caption using the creative angle
            // =================================================================
            const step4 = logger.startStep("Generate caption");
            
            const captionPrompt = buildCaptionPrompt(postType, chosenAngle, brandAnalysis);
            
            const captionResponse = await callLLM(
                [
                    { role: "system", content: CAPTION_SYSTEM_PROMPT },
                    { role: "user", content: captionPrompt },
                ],
                {
                    model: MODELS.GPT_4_1,
                    temperature: 0.8,
                    maxTokens: 1024,
                }
            );

            const generated = parseJSONResponse<PostGenerationResponse>(captionResponse.content);
            
            logger.completeStep(step4, `${generated.caption.length} chars`);

            // =================================================================
            // STEP 5: Generate image (post-type specific templates)
            // =================================================================
            const step5 = logger.startStep("Generate image");
            
            // Collect reference images - profile pic FIRST (for logo), then posts
            const imageReferenceImages: Array<{ url: string }> = [];
            
            // Add profile picture first (will be used as logo in the design)
            const hasProfilePic = !!profileData.profilePicUrl;
            if (profileData.profilePicUrl) {
                imageReferenceImages.push({ url: profileData.profilePicUrl });
                console.log(`[DEMO] Added profile picture as logo reference`);
            }
            
            // Add post images
            const postImages = allPosts
                .filter((p) => p.mediaUrl && !p.mediaType.toLowerCase().includes("video"))
                .map((p) => ({ url: p.mediaUrl }));
            imageReferenceImages.push(...postImages);
            
            console.log(`[DEMO] Total reference images: ${imageReferenceImages.length} (${hasProfilePic ? "1 logo + " : ""}${postImages.length} posts)`);

            const imagePrompt = buildImagePrompt(
                handle,
                generated.caption,
                chosenAngle.angle,
                brandAnalysis,
                imageReferenceImages.length > 0,
                hasProfilePic,
                postType
            );

            let generatedImageBase64: string | undefined;
            let generatedImageMimeType: string | undefined;

            try {
                const imageResult = await generateImage(imagePrompt, {
                    referenceImages: imageReferenceImages.length > 0 ? imageReferenceImages : undefined,
                });
                generatedImageBase64 = imageResult.imageBase64;
                generatedImageMimeType = imageResult.mimeType;
                logger.completeStep(step5, "Success");
            } catch (imageError) {
                logger.failStep(step5, imageError instanceof Error ? imageError.message : "Unknown error");
            }

            // =================================================================
            // STEP 6: Finalize
            // =================================================================
            const step6 = logger.startStep("Finalize");
            
            if (!isAuthenticated && args.fingerprint) {
                await ctx.runMutation(api.demoUsage.recordDemoUsage, {
                    fingerprint: args.fingerprint,
                    instagramHandle: handle,
                });
            }

            logger.completeStep(step6);
            
            console.log("=".repeat(60));
            console.log(`[DEMO] ${logger.getSummary()}`);
            console.log("=".repeat(60));

            return {
                success: true,
                generatedCaption: generated.caption,
                generatedImageBase64,
                generatedImageMimeType,
                reasoning: generated.reasoning,
                sourcePosts: allPosts.slice(0, 3),
                brandAnalysis: {
                    brandVoice: brandAnalysis.brandVoice.recommended,
                    targetAudience: brandAnalysis.targetAudience.recommended,
                    contentPillars: brandAnalysis.contentPillars.map((p) => p.name),
                },
                hasLimitedContext,
                creativeAngle: chosenAngle.angle,
            };
        } catch (error) {
            console.error("[DEMO] Error:", error);
            console.log(`[DEMO] ${logger.getSummary()}`);
            return {
                success: false,
                generatedCaption: "",
                reasoning: "",
                sourcePosts: [],
                error: error instanceof Error ? error.message : "Erro ao gerar post.",
            };
        }
    },
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function extractPosts(items: RawInstagramItem[]): DemoPost[] {
    const posts: DemoPost[] = [];

    for (const item of items) {
        const mediaType = (item.type || item.mediaType || "IMAGE").toUpperCase();
        const isVideo = mediaType.includes("VIDEO") || mediaType === "REEL";

        if (isVideo) continue;

        const mediaUrl = item.displayUrl || item.imageUrl || item.thumbnailUrl;
        if (!mediaUrl) continue;

        posts.push({
            caption: item.caption || item.description || "",
            mediaUrl,
            likeCount: item.likesCount || item.likeCount,
            commentsCount: item.commentsCount || item.commentCount,
            timestamp: normalizeTimestamp(item.timestamp || item.takenAt),
            mediaType,
        });
    }

    return posts;
}

function extractProfileData(items: RawInstagramItem[], handle: string) {
    const first = items[0] || {};
    const owner = first.ownerUsername ? first : (first.owner || {});

    // Extract profile picture URL from various possible fields
    const profilePicUrl = 
        owner.profilePicUrl ||
        owner.profilePictureUrl ||
        owner.profilePicUrlHd ||
        owner.profilePicUrlHD ||
        owner.profile_pic_url ||
        owner.profile_pic_url_hd ||
        first.ownerProfilePicUrl ||
        first.ownerProfilePicUrlHd ||
        first.profilePicUrl ||
        first.profile_pic_url ||
        null;

    return {
        handle,
        bio: owner.biography || first.ownerBiography || "",
        followersCount: owner.followersCount || owner.edge_followed_by?.count,
        postsCount: owner.postsCount || owner.edge_owner_to_timeline_media?.count,
        profilePicUrl,
    };
}

function normalizeTimestamp(ts: string | number | undefined): string {
    if (!ts) return new Date().toISOString();
    if (typeof ts === "number") {
        const msTs = ts < 1e12 ? ts * 1000 : ts;
        return new Date(msTs).toISOString();
    }
    return ts;
}
