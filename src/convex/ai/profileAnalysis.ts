"use node";

import { v } from "convex/values";
import { z } from "zod";
import { Effect } from "effect";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { TextGeneration, MODELS, runAiEffectOrThrow } from "./llm/index";

// ============================================================================
// Schema
// ============================================================================

const ProfileAnalysisSchema = z.object({
    accountDescription: z.string(),
    brandTraits: z.array(z.string()).min(1).max(10),
    additionalContext: z.string(),
});

type ProfileAnalysisResult = z.infer<typeof ProfileAnalysisSchema>;

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `Voce e um especialista em analise de perfis de redes sociais. Sua tarefa e analisar os dados de um perfil do Instagram (bio e legendas de posts) para extrair informacoes uteis sobre a marca/conta.

## Sua Tarefa

Analise os dados fornecidos e retorne um JSON com:

1. **accountDescription**: Uma descricao clara e concisa (2-4 frases) sobre:
   - Qual e o nicho ou area de atuacao da conta
   - Quem e o publico-alvo
   - Qual e a proposta de valor ou diferencial

2. **brandTraits**: Uma lista de 3 a 8 caracteristicas que definem o tom e personalidade da marca, baseado nas legendas. Exemplos:
   - Tom: "profissional", "descontraido", "inspirador", "educativo", "humoristico"
   - Estilo: "direto", "storytelling", "emocional", "tecnico", "coloquial"
   - Valores: "autenticidade", "qualidade", "inovacao", "tradicao", "exclusividade"

3. **additionalContext**: Observacoes adicionais uteis para geracao de conteudo:
   - Padroes de postagem (tipos de conteudo, formatos preferidos)
   - Temas recorrentes ou topicos frequentes
   - Estilo de hashtags (se usa muitas, poucas, especificas do nicho)
   - Chamadas para acao comuns (se houver)
   - Qualquer outro padrao relevante identificado

## Diretrizes

- Escreva tudo em portugues brasileiro
- Seja especifico e baseado nos dados fornecidos
- Se os dados forem insuficientes para algum campo, faca inferencias razoaveis
- Mantenha as caracteristicas da marca (brandTraits) como palavras/frases curtas
- A descricao deve ser util para que uma IA entenda o contexto ao gerar legendas

## Formato de Resposta

Responda APENAS com JSON valido no formato especificado.`;

// ============================================================================
// Action
// ============================================================================

export const analyzeProfileForConfig = action({
    args: {
        projectId: v.id("projects"),
    },
    handler: async (ctx, args): Promise<ProfileAnalysisResult> => {
        // 1. Auth check
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Voce precisa estar autenticado");
        }

        // 2. Get project data
        const project = await ctx.runQuery(api.projects.get, {
            projectId: args.projectId,
        });
        if (!project) {
            throw new Error("Projeto nao encontrado");
        }

        // 3. Get Instagram posts
        const posts = await ctx.runQuery(api.instagramPosts.listByProject, {
            projectId: args.projectId,
        });

        // 4. Check if we have enough data
        const bio = project.bio;
        const captions = posts
            .filter((post) => post.caption && post.caption.trim().length > 0)
            .map((post) => ({
                caption: post.caption!,
                likeCount: post.likeCount ?? 0,
                commentsCount: post.commentsCount ?? 0,
            }));

        if (!bio && captions.length === 0) {
            throw new Error(
                "Dados insuficientes para analise. Certifique-se de que o perfil do Instagram foi sincronizado."
            );
        }

        // 5. Sort captions by engagement and take top 30
        const sortedCaptions = captions
            .sort((a, b) => {
                const engagementA = a.likeCount + a.commentsCount * 2;
                const engagementB = b.likeCount + b.commentsCount * 2;
                return engagementB - engagementA;
            })
            .slice(0, 30);

        // 6. Build user prompt with data
        let userPrompt = "## Dados do Perfil\n\n";

        if (bio) {
            userPrompt += `### Bio do Perfil\n"${bio}"\n\n`;
        }

        if (sortedCaptions.length > 0) {
            userPrompt += `### Legendas Recentes (${sortedCaptions.length} posts, ordenados por engajamento)\n\n`;
            sortedCaptions.forEach((post, index) => {
                userPrompt += `**Post ${index + 1}** (${post.likeCount} curtidas, ${post.commentsCount} comentarios):\n"${post.caption}"\n\n`;
            });
        }

        userPrompt += "\nAnalise estes dados e retorne o JSON com accountDescription, brandTraits e additionalContext.";

        // 7. Call AI
        const result = await runAiEffectOrThrow(
            Effect.gen(function* () {
                const textGen = yield* TextGeneration;
                return yield* textGen.generateStructured({
                    messages: [
                        { role: "system", content: SYSTEM_PROMPT },
                        { role: "user", content: userPrompt },
                    ],
                    schema: ProfileAnalysisSchema,
                    model: MODELS.GEMINI_2_5_FLASH,
                    temperature: 0.7,
                    maxTokens: 2048,
                });
            })
        );

        return result;
    },
});
