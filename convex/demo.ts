"use node";

import { ApifyClient } from "apify-client";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { callLLM, parseJSONResponse, generateImage, MODELS } from "./ai/llm";
import {
    PostGenerationResponse,
    IMAGE_GENERATION_PROMPT,
    ImageStyleType,
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
}

// =============================================================================
// SPECIALIZED POST GENERATION PROMPTS
// =============================================================================

const SPECIALIZED_SYSTEM_PROMPTS: Record<PostType, string> = {
    promocao: `Você é um copywriter especializado em posts promocionais para Instagram. Seu objetivo é criar legendas que VENDEM.

Você receberá:
1. Análise completa da marca (voz, público, pilares)
2. Posts anteriores da marca para entender o tom
3. Tendências e contexto do mercado

Sua legenda DEVE:
- Ter um GANCHO irresistível nas primeiras palavras
- Destacar BENEFÍCIOS claros do produto/serviço
- Criar URGÊNCIA ou ESCASSEZ quando apropriado
- Ter um CTA (Call-to-Action) direto e claro
- Usar gatilhos mentais de forma ética
- Incluir emojis estratégicos (não excessivos)
- Ter hashtags relevantes para venda e nicho

IMPORTANTE: Responda APENAS com JSON válido. Escreva em português brasileiro.`,

    conteudo_profissional: `Você é um estrategista de conteúdo especializado em posts de AUTORIDADE para Instagram. Seu objetivo é posicionar a marca como REFERÊNCIA no mercado.

Você receberá:
1. Análise completa da marca (voz, público, pilares)
2. Posts anteriores da marca para entender o tom
3. Contexto do mercado e área de atuação

Sua legenda DEVE:
- Compartilhar CONHECIMENTO valioso sobre o nicho
- Educar a audiência com informações úteis
- Demonstrar EXPERTISE e profundidade no assunto
- Usar dados, fatos ou insights interessantes
- Tom profissional mas acessível
- Gerar valor ANTES de pedir qualquer ação
- Incluir emojis moderados e profissionais
- Ter hashtags de autoridade e nicho

IMPORTANTE: Responda APENAS com JSON válido. Escreva em português brasileiro.`,

    engajamento: `Você é um especialista em posts VIRAIS e de ENGAJAMENTO para Instagram. Seu objetivo é criar conexão emocional e gerar interação.

Você receberá:
1. Análise completa da marca (voz, público, pilares)
2. Posts anteriores da marca para entender o tom
3. Contexto do mercado

Sua legenda DEVE:
- Criar CONEXÃO EMOCIONAL com a audiência
- Fazer PERGUNTAS que gerem comentários
- Usar storytelling envolvente
- Ser RELATABLE (a audiência deve se identificar)
- Incluir hooks curiosos ou controversos (de forma ética)
- Incentivar compartilhamentos e saves
- Tom conversacional e próximo
- Emojis que transmitam emoção
- Hashtags de engajamento e nicho

DICA: Pense em conteúdo tipo "Top 10 celebridades que usam [produto]", "O que ninguém te conta sobre [nicho]", perguntas polêmicas do setor, etc.

IMPORTANTE: Responda APENAS com JSON válido. Escreva em português brasileiro.`,
};

const buildSpecializedUserPrompt = (
    postType: PostType,
    brandAnalysis: {
        businessCategory?: string;
        productOrService?: string;
        brandVoice: { current: string; recommended: string; tone: string[] };
        contentPillars: Array<{ name: string; description: string }>;
        targetAudience: { current: string; recommended: string };
    },
    posts: DemoPost[],
    additionalContext?: string
): string => {
    const postsContext = posts.length > 0
        ? posts.map((p, i) => `Post ${i + 1}: "${p.caption}"`).join("\n")
        : "Sem posts anteriores disponíveis.";

    const baseContext = `
## MARCA
- Negócio: ${brandAnalysis.businessCategory || "Não identificado"}
- Produto/Serviço: ${brandAnalysis.productOrService || "Não identificado"}
- Voz da marca: ${brandAnalysis.brandVoice.recommended}
- Tom: ${brandAnalysis.brandVoice.tone.join(", ")}
- Público-alvo: ${brandAnalysis.targetAudience.recommended}

## PILARES DE CONTEÚDO
${brandAnalysis.contentPillars.map(p => `- ${p.name}: ${p.description}`).join("\n")}

## POSTS ANTERIORES (referência de estilo)
${postsContext}

${additionalContext ? `## CONTEXTO ADICIONAL\n${additionalContext}` : ""}
`;

    const typeSpecificInstructions: Record<PostType, string> = {
        promocao: `
## OBJETIVO: POST PROMOCIONAL
Crie uma legenda que VENDA o produto/serviço da marca.

Considere:
- Qual é o principal benefício que o cliente ganha?
- Que problema o produto resolve?
- Por que alguém deveria comprar AGORA?

A legenda deve fazer o leitor querer comprar ou saber mais.`,

        conteudo_profissional: `
## OBJETIVO: POST DE AUTORIDADE
Crie uma legenda que posicione a marca como ESPECIALISTA no assunto.

Considere:
- Que conhecimento único a marca pode compartilhar?
- Que dúvidas comuns do público você pode responder?
- Que insight valioso sobre o mercado/produto você pode oferecer?

A legenda deve fazer o leitor pensar "essa marca realmente entende do assunto".`,

        engajamento: `
## OBJETIVO: POST DE ENGAJAMENTO
Crie uma legenda que gere CONEXÃO e INTERAÇÃO com a audiência.

Considere:
- Que pergunta interessante você pode fazer?
- Que curiosidade ou fato surpreendente sobre o nicho você pode compartilhar?
- Que história relatable você pode contar?

Exemplos de abordagens:
- "Você sabia que [fato surpreendente sobre o nicho]?"
- "Quem mais [situação comum do público]?"
- "Top 5 [algo interessante relacionado ao produto]"
- Perguntas de opinião que gerem debate saudável

A legenda deve fazer o leitor querer comentar ou compartilhar.`,
    };

    return `${baseContext}

${typeSpecificInstructions[postType]}

## FORMATO DE RESPOSTA (JSON)
{
  "caption": "legenda completa com emojis e hashtags",
  "reasoning": "explicação de 2-3 frases sobre as escolhas criativas"
}

Crie uma legenda ÚNICA e CRIATIVA. Responda com APENAS o objeto JSON.`;
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
            // STEP 3: Generate specialized caption based on post type
            // =================================================================
            const step3 = logger.startStep("Generate caption", POST_TYPE_LABELS[postType]);
            
            const systemPrompt = SPECIALIZED_SYSTEM_PROMPTS[postType];
            const userPrompt = buildSpecializedUserPrompt(
                postType,
                brandAnalysis,
                allPosts,
                args.additionalContext
            );

            const captionResponse = await callLLM(
                [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                {
                    model: MODELS.GPT_4_1,
                    temperature: 0.85,
                    maxTokens: 1024,
                }
            );

            const generated = parseJSONResponse<PostGenerationResponse>(captionResponse.content);
            
            logger.completeStep(step3, `${generated.caption.length} chars`);

            // =================================================================
            // STEP 4: Generate image
            // =================================================================
            const step4 = logger.startStep("Generate image");
            
            const imageReferenceImages = allPosts
                .filter((p) => p.mediaUrl && !p.mediaType.toLowerCase().includes("video"))
                .slice(0, 5)
                .map((p) => ({ url: p.mediaUrl }));

            const imagePrompt = IMAGE_GENERATION_PROMPT({
                brandName: handle,
                visualStyle: "Moderno e profissional",
                caption: generated.caption,
                additionalContext: args.additionalContext,
                imageStyle: args.imageStyle as ImageStyleType | undefined,
                hasReferenceImages: imageReferenceImages.length > 0,
                businessCategory: brandAnalysis.businessCategory,
                postType,
            });

            let generatedImageBase64: string | undefined;
            let generatedImageMimeType: string | undefined;

            try {
                const imageResult = await generateImage(imagePrompt, {
                    referenceImages: imageReferenceImages.length > 0 ? imageReferenceImages : undefined,
                });
                generatedImageBase64 = imageResult.imageBase64;
                generatedImageMimeType = imageResult.mimeType;
                logger.completeStep(step4, "Success");
            } catch (imageError) {
                logger.failStep(step4, imageError instanceof Error ? imageError.message : "Unknown error");
            }

            // =================================================================
            // STEP 5: Finalize
            // =================================================================
            const step5 = logger.startStep("Finalize");
            
            if (!isAuthenticated && args.fingerprint) {
                await ctx.runMutation(api.demoUsage.recordDemoUsage, {
                    fingerprint: args.fingerprint,
                    instagramHandle: handle,
                });
            }

            logger.completeStep(step5);
            
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

    return {
        handle,
        bio: owner.biography || first.ownerBiography || "",
        followersCount: owner.followersCount || owner.edge_followed_by?.count,
        postsCount: owner.postsCount || owner.edge_owner_to_timeline_media?.count,
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
