"use node";

import { v } from "convex/values";
import { z } from "zod";
import { Effect } from "effect";
import { action, type ActionCtx } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { MODELS, runAiEffectOrThrow, TextGeneration } from "./llm/index";

const INTELLIGENCE_MODEL = MODELS.KIMI_K2;

const bounded = (max: number) =>
    z.preprocess((value) => {
        if (typeof value !== "string") return "";
        return value.length > max ? value.slice(0, max) : value;
    }, z.string().max(max));

const BrandIntelligenceSchema = z.object({
    summary: bounded(900),
    contentPillars: z.array(z.string().max(140)).min(1).max(10),
    audienceSignals: z.array(z.string().max(160)).max(10),
    visualDirection: z.array(z.string().max(160)).max(10),
    recommendationNotes: z.array(z.string().max(180)).max(12),
});
type BrandIntelligenceOutput = z.infer<typeof BrandIntelligenceSchema>;
type StoredBrandIntelligence = BrandIntelligenceOutput & {
    sourcePostCount: number;
    generatedAt: number;
};

const StrategySnapshotSchema = z.object({
    summary: bounded(1000),
    confidence: z.enum(["Baixa", "Média", "Alta"]),
    audienceSignals: z.array(z.string().max(180)).max(8),
    contentPillars: z.array(z.string().max(120)).max(8),
    workingThemes: z.array(z.object({ label: z.string().max(80), evidence: z.string().max(180), engagementRate: z.number().optional() })).max(8),
    visualDirection: z.array(z.string().max(180)).max(8),
    avoidList: z.array(z.string().max(160)).max(8),
    suggestedExperiments: z.array(z.object({ title: z.string().max(120), expectedImpact: z.string().max(140) })).max(8),
    next7DaysPlan: z.array(z.object({ dateLabel: z.string().max(40), idea: z.string().max(160), format: z.string().max(60) })).max(7),
});
type StrategySnapshotOutput = z.infer<typeof StrategySnapshotSchema>;

const PostIntelligenceSchema = z.object({
    topic: bounded(140),
    hook: bounded(180),
    format: bounded(120),
    visualSignals: z.array(z.string().max(140)).max(8),
    performanceNotes: z.array(z.string().max(160)).max(8),
    recommendationWeight: z.number().min(0).max(1),
});
type PostIntelligenceOutput = z.infer<typeof PostIntelligenceSchema>;
type StoredPostIntelligence = PostIntelligenceOutput & {
    analyzedAt: number;
};

function postBlock(posts: Doc<"social_posts">[]): string {
    return posts
        .map((post, index) => {
            const metrics = [
                post.likeCount !== undefined ? `${post.likeCount} likes` : null,
                post.commentsCount !== undefined ? `${post.commentsCount} comentários` : null,
                post.engagementScore !== undefined
                    ? `engajamento ${post.engagementScore.toFixed(4)}`
                    : null,
            ].filter(Boolean).join(", ");
            return [
                `[${index}] ${new Date(post.publishedAt).toISOString()} ${post.mediaType}`,
                metrics ? `Métricas: ${metrics}` : null,
                post.caption ? `Legenda: ${post.caption.slice(0, 1400)}` : "Sem legenda.",
                `Permalink: ${post.permalink}`,
            ].filter(Boolean).join("\n");
        })
        .join("\n---\n");
}

export const regenerateBrandIntelligence = action({
    args: {
        projectId: v.id("projects"),
        limit: v.optional(v.number()),
    },
    handler: async (
        ctx: ActionCtx,
        args
    ): Promise<StoredBrandIntelligence> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Não autenticado");

        const project = await ctx.runQuery(api.projects.get, { projectId: args.projectId }) as
            | Doc<"projects">
            | null;
        if (!project) throw new Error("Projeto não encontrado");

        const posts = await ctx.runQuery(api.socialPosts.listByProject, {
            projectId: args.projectId,
            limit: Math.min(50, Math.max(5, args.limit ?? 30)),
        }) as Doc<"social_posts">[];
        if (posts.length === 0) {
            throw new Error("Sincronize posts do Instagram antes de gerar inteligência de marca.");
        }

        const system = `You are Vanda, a senior social media strategist. Return JSON only. Keys stay in English; values in Brazilian Portuguese. Infer only from imported posts and project context.`;
        const user = [
            `## Projeto\nNome: ${project.name}`,
            project.brandContextMarkdown ? `Contexto atual:\n${project.brandContextMarkdown}` : null,
            `## Posts importados\n${postBlock(posts)}`,
            "## Tarefa\nCrie uma inteligência de marca prática para orientar recomendações futuras. Seja específico, útil e não invente dados que não aparecem nos posts.",
        ].filter(Boolean).join("\n\n");

        const out = await runAiEffectOrThrow(
            Effect.gen(function* () {
                const textGen = yield* TextGeneration;
                return yield* textGen.generateStructured({
                    messages: [
                        { role: "system", content: system },
                        { role: "user", content: user },
                    ],
                    schema: BrandIntelligenceSchema,
                    model: INTELLIGENCE_MODEL,
                    temperature: 0.35,
                    maxTokens: 4096,
                });
            })
        ) as BrandIntelligenceOutput;

        const intelligence: StoredBrandIntelligence = {
            ...out,
            sourcePostCount: posts.length,
            generatedAt: Date.now(),
        };
        await ctx.runMutation(internal.projects.setBrandIntelligenceInternal, {
            projectId: args.projectId,
            intelligence,
        });
        return intelligence;
    },
});

export const analyzePost = action({
    args: {
        socialPostId: v.id("social_posts"),
    },
    handler: async (
        ctx: ActionCtx,
        args
    ): Promise<StoredPostIntelligence> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Não autenticado");

        const post = await ctx.runQuery(internal.socialPosts.getForAnalysisInternal, {
            clerkId: identity.subject,
            socialPostId: args.socialPostId,
        }) as Doc<"social_posts">;

        await ctx.runMutation(internal.socialPosts.setPostIntelligenceStatusInternal, {
            socialPostId: args.socialPostId,
            status: "running",
        });

        const system = `You are Vanda, a concise Instagram analyst. Return JSON only. Keys stay in English; all string values in Brazilian Portuguese.`;
        const user = [
            `## Post\nTipo: ${post.mediaType}`,
            `Publicado: ${new Date(post.publishedAt).toISOString()}`,
            post.likeCount !== undefined ? `Likes: ${post.likeCount}` : null,
            post.commentsCount !== undefined ? `Comentários: ${post.commentsCount}` : null,
            post.engagementScore !== undefined ? `Engajamento normalizado: ${post.engagementScore}` : null,
            post.caption ? `Legenda:\n${post.caption}` : "Sem legenda.",
            "## Tarefa\nAnalise o gancho, tema, formato, sinais visuais e o que a Vanda deve aprender desse post para futuras recomendações.",
        ].filter(Boolean).join("\n\n");

        try {
            const out = await runAiEffectOrThrow(
                Effect.gen(function* () {
                    const textGen = yield* TextGeneration;
                    return yield* textGen.generateStructured({
                        messages: [
                            { role: "system", content: system },
                            { role: "user", content: user },
                        ],
                        schema: PostIntelligenceSchema,
                        model: INTELLIGENCE_MODEL,
                        temperature: 0.25,
                        maxTokens: 2048,
                    });
                })
            ) as PostIntelligenceOutput;

            const intelligence: StoredPostIntelligence = {
                ...out,
                analyzedAt: Date.now(),
            };
            await ctx.runMutation(internal.socialPosts.setPostIntelligenceInternal, {
                socialPostId: args.socialPostId,
                intelligence,
            });
            return intelligence;
        } catch (error) {
            await ctx.runMutation(internal.socialPosts.setPostIntelligenceStatusInternal, {
                socialPostId: args.socialPostId,
                status: "failed",
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    },
});

export const regenerateStrategySnapshot = action({
    args: { projectId: v.id("projects"), limit: v.optional(v.number()) },
    handler: async (ctx: ActionCtx, args): Promise<StrategySnapshotOutput> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Não autenticado");
        const project = await ctx.runQuery(api.projects.get, { projectId: args.projectId }) as Doc<"projects"> | null;
        if (!project) throw new Error("Projeto não encontrado");
        const posts = await ctx.runQuery(api.socialPosts.listByProject, { projectId: args.projectId, limit: Math.min(80, Math.max(10, args.limit ?? 40)) }) as Doc<"social_posts">[];
        if (posts.length === 0) throw new Error("Sincronize posts do Instagram antes de gerar estratégia.");
        const system = `You are Vanda, a senior Instagram strategist. Return JSON only. Keys in English, values in Brazilian Portuguese. Only infer from provided real Instagram metrics and captions.`;
        const user = [`Projeto: ${project.name}`, `Posts importados:\n${postBlock(posts)}`, `Tarefa: crie memória estratégica, pilares, sinais, temas que funcionam, direção visual, coisas a evitar, experimentos e plano para 7 dias.`].join("\n\n");
        const out = await runAiEffectOrThrow(Effect.gen(function* () {
            const textGen = yield* TextGeneration;
            return yield* textGen.generateStructured({ messages: [{ role: "system", content: system }, { role: "user", content: user }], schema: StrategySnapshotSchema, model: INTELLIGENCE_MODEL, temperature: 0.35, maxTokens: 4096 });
        })) as StrategySnapshotOutput;
        await ctx.runMutation(internal.projectAnalytics.createStrategySnapshotInternal, {
            projectId: args.projectId,
            sourcePostIds: posts.map((p) => p._id),
            analyzedFrom: Math.min(...posts.map((p) => p.publishedAt)),
            analyzedTo: Math.max(...posts.map((p) => p.publishedAt)),
            postCount: posts.length,
            ...out,
            workingThemes: out.workingThemes.map((theme) => ({
                label: theme.label,
                evidence: theme.evidence,
                ...(theme.engagementRate !== undefined ? { engagementRate: theme.engagementRate } : {}),
            })),
        });
        return out;
    },
});
