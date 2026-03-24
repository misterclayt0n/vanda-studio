"use node";

import { v } from "convex/values";
import { z } from "zod";
import { Effect } from "effect";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { TextGeneration, MODELS, runAiEffectOrThrow } from "./llm/index";
import { assertSafePublicHttpUrl, UnsafeUrlError } from "../urlSafety";
import type { Doc } from "../_generated/dataModel";

const MAX_HTML_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
const LLM_TEXT_SNIPPET_CHARS = 12_000;

// ============================================================================
// Zod — full kit suggestion (no storage ids)
// ============================================================================
//
// LLMs (esp. via OpenRouter) often emit JSON with `null` for "empty" optional
// fields. Zod's `.optional()` only allows `undefined`, not `null`, which makes
// `generateText` + `Output.object` throw after JSON parse → MalformedResponseError.

const llmOptStr = z.string().nullish();
/** Accept [], null, or a single comma-separated string from sloppy models. */
const llmOptStrArray = z.preprocess((val) => {
    if (val == null) return undefined;
    if (Array.isArray(val)) {
        return val.filter((x): x is string => typeof x === "string");
    }
    if (typeof val === "string") {
        return val
            .split(/[,;\n]/)
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return undefined;
}, z.array(z.string()).nullish());

const BrandKitSuggestionSchema = z.object({
    elevatorPitch: llmOptStr,
    whatWeSell: llmOptStr,
    whoWeServe: llmOptStr,
    differentiators: llmOptStr,
    competitorsNotes: llmOptStr,
    toneAdjectives: llmOptStrArray,
    writingRules: llmOptStr,
    languages: llmOptStrArray,
    emojiPolicy: llmOptStr,
    ctaStyle: llmOptStr,
    primaryColors: llmOptStrArray,
    secondaryColors: llmOptStrArray,
    typographyPrimary: llmOptStr,
    typographySecondary: llmOptStr,
    imageryGuidelines: llmOptStr,
});

const PositioningSectionSchema = z.object({
    elevatorPitch: llmOptStr,
    whatWeSell: llmOptStr,
    whoWeServe: llmOptStr,
    differentiators: llmOptStr,
    competitorsNotes: llmOptStr,
});

const VoiceSectionSchema = z.object({
    toneAdjectives: llmOptStrArray,
    writingRules: llmOptStr,
    languages: llmOptStrArray,
    emojiPolicy: llmOptStr,
    ctaStyle: llmOptStr,
});

const VisualSectionSchema = z.object({
    primaryColors: llmOptStrArray,
    secondaryColors: llmOptStrArray,
    typographyPrimary: llmOptStr,
    typographySecondary: llmOptStr,
    imageryGuidelines: llmOptStr,
});

export type BrandKitSuggestion = z.infer<typeof BrandKitSuggestionSchema>;

// ============================================================================
// HTML extraction (no extra dependencies)
// ============================================================================

function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ");
}

function matchMeta(html: string, attr: "name" | "property", key: string): string | undefined {
    const re = new RegExp(
        `<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']*)["']`,
        "i"
    );
    const m = re.exec(html);
    if (m?.[1]) return decodeHtmlEntities(m[1]).trim();
    const re2 = new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${key}["']`,
        "i"
    );
    const m2 = re2.exec(html);
    return m2?.[1] ? decodeHtmlEntities(m2[1]).trim() : undefined;
}

function extractTitle(html: string): string | undefined {
    const m = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
    return m?.[1] ? decodeHtmlEntities(m[1]).trim() : undefined;
}

function roughTextFromHtml(html: string): string {
    const noScripts = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ");
    const text = noScripts.replace(/<[^>]+>/g, " ");
    return decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
}

export type ExtractedPageSignals = {
    title?: string;
    description?: string;
    ogTitle?: string;
    ogDescription?: string;
    themeColor?: string;
};

function extractPageSignals(html: string): ExtractedPageSignals {
    const out: ExtractedPageSignals = {};
    const title = extractTitle(html);
    if (title) out.title = title;
    const description = matchMeta(html, "name", "description");
    if (description) out.description = description;
    const ogTitle = matchMeta(html, "property", "og:title");
    if (ogTitle) out.ogTitle = ogTitle;
    const ogDescription = matchMeta(html, "property", "og:description");
    if (ogDescription) out.ogDescription = ogDescription;
    const themeColor = matchMeta(html, "name", "theme-color");
    if (themeColor) out.themeColor = themeColor;
    return out;
}

async function fetchHtmlLimited(url: string): Promise<{ html: string; truncated: boolean }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            redirect: "follow",
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; VandaStudio/1.0; +https://vanda.studio)",
                Accept: "text/html,application/xhtml+xml",
            },
        });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        const buf = await res.arrayBuffer();
        const truncated = buf.byteLength > MAX_HTML_BYTES;
        const slice = buf.byteLength > MAX_HTML_BYTES ? buf.slice(0, MAX_HTML_BYTES) : buf;
        const html = new TextDecoder("utf-8", { fatal: false }).decode(slice);
        return { html, truncated };
    } finally {
        clearTimeout(timer);
    }
}

function summarizeProjectForPrompt(project: Doc<"projects">): string {
    const parts: string[] = [`Nome: ${project.name}`];
    if (project.accountDescription) parts.push(`Descrição: ${project.accountDescription}`);
    if (project.brandTraits?.length) parts.push(`Traços: ${project.brandTraits.join(", ")}`);
    if (project.additionalContext) parts.push(`Contexto: ${project.additionalContext}`);
    if (project.brandKit) {
        const k = project.brandKit;
        if (k.elevatorPitch) parts.push(`Pitch: ${k.elevatorPitch}`);
        if (k.whatWeSell) parts.push(`Oferta: ${k.whatWeSell}`);
        if (k.whoWeServe) parts.push(`Público: ${k.whoWeServe}`);
        if (k.toneAdjectives?.length) parts.push(`Tom: ${k.toneAdjectives.join(", ")}`);
        if (k.primaryColors?.length) parts.push(`Cores: ${k.primaryColors.join(", ")}`);
    }
    return parts.join("\n");
}

// ============================================================================
// Actions
// ============================================================================

const SECTION_VALIDATOR = v.union(
    v.literal("positioning"),
    v.literal("voice"),
    v.literal("visual")
);

export const suggestBrandKitFromDescription = action({
    args: {
        description: v.string(),
        nicheHint: v.optional(v.string()),
        audienceHint: v.optional(v.string()),
        referenceBrands: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<BrandKitSuggestion> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Você precisa estar autenticado");
        }

        let userPrompt = `## Briefing do usuário\n${args.description.trim()}\n`;
        if (args.nicheHint?.trim()) userPrompt += `\n## Nicho\n${args.nicheHint.trim()}\n`;
        if (args.audienceHint?.trim()) userPrompt += `\n## Público\n${args.audienceHint.trim()}\n`;
        if (args.referenceBrands?.trim()) {
            userPrompt += `\n## Marcas de referência\n${args.referenceBrands.trim()}\n`;
        }
        userPrompt +=
            "\nGere sugestões coerentes de marca em português brasileiro. Use hex para cores quando possível (ex: #1a1a1a).";

        const system = `Você é estrategista de marca para redes sociais. Retorne apenas JSON válido que siga o schema:
campos opcionais: elevatorPitch, whatWeSell, whoWeServe, differentiators, competitorsNotes,
toneAdjectives[], writingRules, languages[], emojiPolicy, ctaStyle,
primaryColors[], secondaryColors[], typographyPrimary, typographySecondary, imageryGuidelines.
Seja específico e evite clichês vazios.`;

        return await runAiEffectOrThrow(
            Effect.gen(function* () {
                const textGen = yield* TextGeneration;
                return yield* textGen.generateStructured({
                    messages: [
                        { role: "system", content: system },
                        { role: "user", content: userPrompt },
                    ],
                    schema: BrandKitSuggestionSchema,
                    model: MODELS.GEMINI_2_5_FLASH,
                    temperature: 0.75,
                    maxTokens: 2048,
                });
            })
        );
    },
});

export const suggestBrandSection = action({
    args: {
        projectId: v.optional(v.id("projects")),
        /** When no project yet (wizard), pass accumulated brand notes as text. */
        draftContext: v.optional(v.string()),
        section: SECTION_VALIDATOR,
        extraHint: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Você precisa estar autenticado");
        }

        if (!args.projectId && !args.draftContext?.trim()) {
            throw new Error("Informe o projeto ou um rascunho de contexto");
        }

        let base: string;
        if (args.projectId) {
            const project = await ctx.runQuery(api.projects.get, { projectId: args.projectId });
            if (!project) {
                throw new Error("Projeto não encontrado");
            }
            base = summarizeProjectForPrompt(project);
        } else {
            base = args.draftContext!.trim();
        }
        let userPrompt = `## Contexto atual do projeto\n${base}\n`;
        if (args.extraHint?.trim()) userPrompt += `\n## Instrução extra\n${args.extraHint.trim()}\n`;

        if (args.section === "positioning") {
            userPrompt +=
                "\nSugira apenas posicionamento: elevatorPitch, whatWeSell, whoWeServe, differentiators, competitorsNotes (todos opcionais no JSON). pt-BR.";
            const system =
                "Você é estrategista de marca. Responda só com JSON válido para o schema pedido.";
            return await runAiEffectOrThrow(
                Effect.gen(function* () {
                    const textGen = yield* TextGeneration;
                    return yield* textGen.generateStructured({
                        messages: [
                            { role: "system", content: system },
                            { role: "user", content: userPrompt },
                        ],
                        schema: PositioningSectionSchema,
                        model: MODELS.GEMINI_2_5_FLASH,
                        temperature: 0.7,
                        maxTokens: 1536,
                    });
                })
            );
        }

        if (args.section === "voice") {
            userPrompt +=
                "\nSugira apenas voz/estilo verbal: toneAdjectives, writingRules, languages, emojiPolicy, ctaStyle. pt-BR. JSON.";
            const system =
                "Você é redator de marca. Responda só com JSON válido para o schema pedido.";
            return await runAiEffectOrThrow(
                Effect.gen(function* () {
                    const textGen = yield* TextGeneration;
                    return yield* textGen.generateStructured({
                        messages: [
                            { role: "system", content: system },
                            { role: "user", content: userPrompt },
                        ],
                        schema: VoiceSectionSchema,
                        model: MODELS.GEMINI_2_5_FLASH,
                        temperature: 0.75,
                        maxTokens: 1536,
                    });
                })
            );
        }

        userPrompt +=
            "\nSugira apenas identidade visual: primaryColors, secondaryColors (hex), typographyPrimary, typographySecondary, imageryGuidelines. JSON.";
        const system =
            "Você é designer de marca. Responda só com JSON válido para o schema pedido.";
        return await runAiEffectOrThrow(
            Effect.gen(function* () {
                const textGen = yield* TextGeneration;
                return yield* textGen.generateStructured({
                    messages: [
                        { role: "system", content: system },
                        { role: "user", content: userPrompt },
                    ],
                    schema: VisualSectionSchema,
                    model: MODELS.GEMINI_2_5_FLASH,
                    temperature: 0.65,
                    maxTokens: 1536,
                });
            })
        );
    },
});

export const ingestWebsiteForBrand = action({
    args: {
        /** When omitted (wizard before project exists), only auth is required. */
        projectId: v.optional(v.id("projects")),
        url: v.string(),
    },
    handler: async (
        ctx,
        args
    ): Promise<{
        suggestion: BrandKitSuggestion;
        warnings: string[];
        signals: ExtractedPageSignals;
    }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Você precisa estar autenticado");
        }

        if (args.projectId) {
            const project = await ctx.runQuery(api.projects.get, { projectId: args.projectId });
            if (!project) {
                throw new Error("Projeto não encontrado");
            }
        }

        const warnings: string[] = [];
        let safeUrl: URL;
        try {
            safeUrl = assertSafePublicHttpUrl(args.url);
        } catch (e) {
            if (e instanceof UnsafeUrlError) {
                throw new Error(e.message);
            }
            throw e;
        }

        let html: string;
        let truncated: boolean;
        try {
            const fetched = await fetchHtmlLimited(safeUrl.href);
            html = fetched.html;
            truncated = fetched.truncated;
        } catch (e) {
            const msg = e instanceof Error ? e.message : "fetch failed";
            throw new Error(`Não foi possível baixar a página: ${msg}`);
        }

        if (truncated) {
            warnings.push("HTML truncado por limite de tamanho; resultados podem estar incompletos.");
        }

        const signals = extractPageSignals(html);
        const textSample = roughTextFromHtml(html).slice(0, LLM_TEXT_SNIPPET_CHARS);
        if (textSample.length < 80) {
            warnings.push(
                "Pouco texto extraído (site pode ser muito dinâmico); complete manualmente ou tente outra URL."
            );
        }

        const metaBlock = [
            signals.title && `title: ${signals.title}`,
            signals.description && `meta description: ${signals.description}`,
            signals.ogTitle && `og:title: ${signals.ogTitle}`,
            signals.ogDescription && `og:description: ${signals.ogDescription}`,
            signals.themeColor && `theme-color: ${signals.themeColor}`,
        ]
            .filter(Boolean)
            .join("\n");

        const userPrompt = `## URL\n${safeUrl.href}\n\n## Meta / cabeçalho\n${metaBlock || "(nenhum)"}\n\n## Amostra de texto da página\n${textSample}\n\nCom base nisso, infira um kit de marca em pt-BR. Use cores em hex quando possível. Campos desconhecidos podem ser omitidos.`;

        const system = `Você analisa sites e propõe identidade de marca para redes sociais.
Retorne JSON no schema: elevatorPitch, whatWeSell, whoWeServe, differentiators, competitorsNotes,
toneAdjectives[], writingRules, languages[], emojiPolicy, ctaStyle,
primaryColors[], secondaryColors[], typographyPrimary, typographySecondary, imageryGuidelines.
Não invente fatos específicos não suportados pelo texto; prefira inferências modestas.`;

        const suggestion = await runAiEffectOrThrow(
            Effect.gen(function* () {
                const textGen = yield* TextGeneration;
                return yield* textGen.generateStructured({
                    messages: [
                        { role: "system", content: system },
                        { role: "user", content: userPrompt },
                    ],
                    schema: BrandKitSuggestionSchema,
                    model: MODELS.GEMINI_2_5_FLASH,
                    temperature: 0.55,
                    maxTokens: 2048,
                });
            })
        );

        return { suggestion, warnings, signals };
    },
});
