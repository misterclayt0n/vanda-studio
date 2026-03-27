"use node";

import { v } from "convex/values";
import { z } from "zod";
import { Effect } from "effect";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { TextGeneration, MODELS, runAiEffectOrThrow } from "./llm/index";

const POST_IDEAS_MODEL = MODELS.KIMI_K2;

const llmBoundedStr = (max: number) =>
    z.preprocess((val) => {
        if (val == null) return undefined;
        if (typeof val === "string") return val.length > max ? val.slice(0, max) : val;
        return undefined;
    }, z.string().max(max));

const PostIdeaSchema = z.object({
    title: llmBoundedStr(120).optional().describe("Short working title for the idea, pt-BR"),
    caption: llmBoundedStr(2200).describe("Full Instagram caption in pt-BR, ready to publish"),
    reasoning: llmBoundedStr(500)
        .optional()
        .describe("Why this idea fits the brand and differs from recent posts"),
    imagePrompt: llmBoundedStr(900).describe(
        "English image generation brief aligned with the caption and brand visual rules"
    ),
    sourcePostIndices: z
        .array(z.number().int().min(0).max(49))
        .max(6)
        .optional()
        .describe("Indices of Instagram posts this idea builds on, or omits if none"),
});

const PostIdeasResponseSchema = z.object({
    ideas: z.array(PostIdeaSchema).min(1).max(5),
});

function projectContextBlock(project: Doc<"projects">): string {
    if (project.brandContextMarkdown?.trim()) {
        return `## Contexto da marca (markdown)\n${project.brandContextMarkdown.trim()}`;
    }
    const parts: string[] = [`Nome: ${project.name}`];
    if (project.accountDescription) parts.push(`Descrição: ${project.accountDescription}`);
    if (project.brandTraits?.length) parts.push(`Traços: ${project.brandTraits.join(", ")}`);
    if (project.additionalContext) parts.push(`Contexto extra: ${project.additionalContext}`);
    if (project.brandKit) {
        const k = project.brandKit;
        if (k.elevatorPitch) parts.push(`Pitch: ${k.elevatorPitch}`);
        if (k.whatWeSell) parts.push(`Oferta: ${k.whatWeSell}`);
        if (k.whoWeServe) parts.push(`Público: ${k.whoWeServe}`);
        if (k.toneAdjectives?.length) parts.push(`Tom: ${k.toneAdjectives.join(", ")}`);
    }
    return `## Contexto do projeto\n${parts.join("\n")}`;
}

function digestSection(d: NonNullable<Doc<"projects">["instagramContentDigest"]>): string {
    const lines = [
        "## O que já apareceu no Instagram (digest automático)",
        d.summaryForModel,
        "",
        `Temas recentes: ${d.recentThemes.length ? d.recentThemes.join(", ") : "(nenhum)"}`,
        `Ganchos/formatos: ${d.recentHooks.length ? d.recentHooks.join(", ") : "(nenhum)"}`,
        `Evitar repetir em seguida: ${d.avoidNext.length ? d.avoidNext.join(" | ") : "(nada específico)"}`,
    ];
    return lines.join("\n");
}

function buildSnippetsPrompt(
    snippets: { _id: Id<"instagram_posts">; caption: string; timestamp: string }[]
): string {
    if (snippets.length === 0) return "(Nenhuma legenda sincronizada — não invente posts passados.)";
    return snippets
        .map((s, i) => `[${i}] (${s.timestamp})\n${s.caption.slice(0, 1200)}`)
        .join("\n---\n");
}

export const generateIdeas = action({
    args: {
        projectId: v.id("projects"),
        userIntent: v.optional(v.string()),
        avoidRecentThemes: v.optional(v.boolean()),
        extraExclusions: v.optional(v.string()),
        count: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Não autenticado");

        const project = await ctx.runQuery(api.projects.get, { projectId: args.projectId });
        if (!project) throw new Error("Projeto não encontrado");

        const n = Math.min(5, Math.max(1, args.count ?? 3));

        const snippets = await ctx.runQuery(internal.instagramPosts.listCaptionSnippetsForDigestInternal, {
            projectId: args.projectId,
            limit: 30,
        });

        const avoid = args.avoidRecentThemes !== false;
        const digest = project.instagramContentDigest;

        let user = projectContextBlock(project);
        user += "\n\n";
        if (digest) {
            user += `${digestSection(digest)}\n\n`;
        } else {
            user +=
                "## Instagram\nNão há digest ainda — sincronize o Instagram do projeto para a Vanda evitar repetir temas recentes.\n\n";
        }

        user += `## Amostra de legendas (índice 0 = mais recente)\n${buildSnippetsPrompt(snippets)}\n\n`;

        if (args.userIntent?.trim()) {
            user += `## Pedido do usuário\n${args.userIntent.trim()}\n\n`;
        }
        if (args.extraExclusions?.trim()) {
            user += `## Exclusões explícitas do usuário\n${args.extraExclusions.trim()}\n\n`;
        }

        user += `## Tarefa\nGere exatamente ${n} ideias de posts NOVOS para Instagram em pt-BR.\n`;
        if (avoid && digest) {
            user +=
                "Não repita campanhas, datas comemorativas ou ângulos listados em 'Evitar repetir' nem duplique os temas recentes, salvo se o usuário pediu explicitamente o contrário acima.\n";
        } else if (avoid) {
            user +=
                "Evite repetir assuntos óbvios que já aparecem nas legendas da amostra; traga ângulos frescos.\n";
        }
        user +=
            "Cada legenda deve soar natural no feed do criador. imagePrompt em inglês para modelo de imagem.\n";
        user += "Use sourcePostIndices apenas se a ideia ecoar posts específicos da lista (opcional).\n";

        const system = `You are Vanda, an editorial assistant. Output valid JSON only for the schema. Captions and titles in Brazilian Portuguese; imagePrompt in English.`;

        const out = await runAiEffectOrThrow(
            Effect.gen(function* () {
                const textGen = yield* TextGeneration;
                return yield* textGen.generateStructured({
                    messages: [
                        { role: "system", content: system },
                        { role: "user", content: user },
                    ],
                    schema: PostIdeasResponseSchema,
                    model: POST_IDEAS_MODEL,
                    temperature: 0.75,
                    maxTokens: 8192,
                });
            })
        );

        const postIds: Id<"generated_posts">[] = [];
        for (const idea of out.ideas) {
            const sourcePostIds = (idea.sourcePostIndices ?? [])
                .map((i) => snippets[i]?._id)
                .filter((id): id is Id<"instagram_posts"> => Boolean(id));

            const id = await ctx.runMutation(api.generatedPosts.create, {
                projectId: args.projectId,
                platform: "instagram",
                ...(idea.title && { title: idea.title }),
                caption: idea.caption,
                ...(idea.reasoning && { reasoning: idea.reasoning }),
                ...(idea.imagePrompt && { imagePrompt: idea.imagePrompt }),
                sourcePostIds: sourcePostIds.length > 0 ? sourcePostIds : undefined,
                model: POST_IDEAS_MODEL,
                status: "generated",
            });
            postIds.push(id);
        }

        return { postIds };
    },
});
