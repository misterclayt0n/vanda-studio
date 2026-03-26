"use node";

import { v } from "convex/values";
import { z } from "zod";
import { Effect } from "effect";
import { ApifyClient } from "apify-client";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { TextGeneration, MODELS, runAiEffectOrThrow } from "./llm/index";

/** OpenRouter model id for brand onboarding actions (structured JSON). */
const BRAND_ONBOARDING_MODEL = MODELS.KIMI_K2;
import { assertSafePublicHttpUrl, UnsafeUrlError } from "../urlSafety";
import type { Doc, Id } from "../_generated/dataModel";

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

/** Max lengths keep JSON small so OpenRouter finishes inside token budget (avoids truncated JSON). */
const MAX_ELEVATOR = 500;
const MAX_SHORT_PARA = 800;
const MAX_WHO_SERVE = 600;
const MAX_WRITING_RULES = 800;
const MAX_IMAGERY = 600;
const MAX_TYPO = 200;
const MAX_POLICY = 600;
const MAX_ARRAY_ITEM = 120;
const MAX_ARRAY_ITEMS = 16;

/** Truncate to max length instead of rejecting — models often overshoot. */
const llmBoundedStr = (max: number) =>
    z.preprocess((val) => {
        if (val == null) return undefined;
        if (typeof val === "string") return val.length > max ? val.slice(0, max) : val;
        return undefined;
    }, z.string().max(max).nullish());

/** Like llmBoundedStr but also accepts an array of strings (joins with newline). */
const llmFlexStr = (max: number) =>
    z.preprocess((val) => {
        if (val == null) return undefined;
        if (Array.isArray(val)) {
            const joined = val.filter((x): x is string => typeof x === "string").join("\n");
            return joined.length > max ? joined.slice(0, max) : joined;
        }
        if (typeof val === "string") return val.length > max ? val.slice(0, max) : val;
        return undefined;
    }, z.string().max(max).nullish());

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
}, z.array(z.string().max(MAX_ARRAY_ITEM)).max(MAX_ARRAY_ITEMS).nullish());

const BrandKitSuggestionSchema = z.object({
    elevatorPitch: llmBoundedStr(MAX_ELEVATOR).describe(
        "Pitch memorável da marca em 1-2 frases. Deve capturar essência + diferencial + emoção."
    ),
    whatWeSell: llmBoundedStr(MAX_SHORT_PARA).describe(
        "O que a marca vende ou oferece. Seja específico: produtos, serviços, formatos, faixas de preço."
    ),
    whoWeServe: llmBoundedStr(MAX_WHO_SERVE).describe(
        "Público-alvo detalhado: demografia, psicografia, comportamentos, dores e desejos. Não diga apenas 'público geral'."
    ),
    differentiators: llmBoundedStr(MAX_SHORT_PARA).describe(
        "O que torna esta marca ÚNICA vs concorrentes? Liste vantagens concretas, não repita o pitch."
    ),
    competitorsNotes: llmBoundedStr(MAX_SHORT_PARA).describe(
        "Análise breve do cenário competitivo: quem são os concorrentes, como se posicionam, onde há oportunidade."
    ),
    toneAdjectives: llmOptStrArray.describe(
        "4-6 adjetivos que definem a personalidade verbal da marca (ex: 'irreverente', 'sofisticado', 'acolhedor')."
    ),
    writingRules: llmFlexStr(MAX_WRITING_RULES).describe(
        "3-5 regras práticas para redatores. Inclua exemplos de FAÇA/NÃO FAÇA. Ex: 'Use primeira pessoa do plural (nós). Evite jargão corporativo.'"
    ),
    languages: llmOptStrArray.describe("Idiomas do conteúdo (ex: 'Português Brasileiro')"),
    emojiPolicy: llmBoundedStr(MAX_POLICY).describe(
        "Como a marca usa emojis: frequência, estilo, exemplos específicos de emojis preferidos."
    ),
    ctaStyle: llmBoundedStr(MAX_POLICY).describe(
        "Estilo de chamada para ação: tom, verbos preferidos, exemplos concretos de CTAs da marca."
    ),
    primaryColors: llmOptStrArray.describe(
        "3-5 cores hex primárias que formam uma paleta ÚNICA para esta marca. Evite paletas genéricas. Considere a personalidade e o setor."
    ),
    secondaryColors: llmOptStrArray.describe(
        "2-4 cores hex secundárias/de apoio que complementam as primárias."
    ),
    typographyPrimary: llmBoundedStr(MAX_TYPO).describe(
        "Família de fonte do Google Fonts para títulos (ex: 'Playfair Display', 'DM Serif Display', 'Sora'). Escolha com base na personalidade da marca."
    ),
    typographySecondary: llmBoundedStr(MAX_TYPO).describe(
        "Família de fonte do Google Fonts para corpo de texto (ex: 'Source Sans 3', 'Lato', 'Nunito'). Deve harmonizar com a primária."
    ),
    imageryGuidelines: llmBoundedStr(MAX_IMAGERY).describe(
        "Diretrizes de fotografia/imagem: estilo visual, iluminação, composição, cores dominantes, mood. Seja específico."
    ),
});

const PositioningSectionSchema = z.object({
    elevatorPitch: llmBoundedStr(MAX_ELEVATOR),
    whatWeSell: llmBoundedStr(MAX_SHORT_PARA),
    whoWeServe: llmBoundedStr(MAX_WHO_SERVE),
    differentiators: llmBoundedStr(MAX_SHORT_PARA),
    competitorsNotes: llmBoundedStr(MAX_SHORT_PARA),
});

const VoiceSectionSchema = z.object({
    toneAdjectives: llmOptStrArray,
    writingRules: llmFlexStr(MAX_WRITING_RULES),
    languages: llmOptStrArray,
    emojiPolicy: llmBoundedStr(MAX_POLICY),
    ctaStyle: llmBoundedStr(MAX_POLICY),
});

const VisualSectionSchema = z.object({
    primaryColors: llmOptStrArray,
    secondaryColors: llmOptStrArray,
    typographyPrimary: llmBoundedStr(MAX_TYPO),
    typographySecondary: llmBoundedStr(MAX_TYPO),
    imageryGuidelines: llmBoundedStr(MAX_IMAGERY),
});

/** Appended to system prompts to keep output focused without starving fields of depth. */
const BREVITY_RULE =
    "REGRA DE QUALIDADE: Preencha TODOS os campos. Cada campo deve ser substantivo (3-5 frases quando necessário), " +
    "mas nunca repetitivo. Listas: 3-8 itens. NUNCA repita a mesma ideia em campos diferentes. " +
    "Se perceber repetição, PARE e feche o JSON.";

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
    cssColors?: string[];
    iconUrl?: string;
};

/** Normalize a 3/4/6/8-digit hex color to uppercase 6-digit hex. */
function normalizeHex(raw: string): string | null {
    let hex = raw.replace(/^#/, "");
    if (hex.length === 3) hex = hex[0]! + hex[0]! + hex[1]! + hex[1]! + hex[2]! + hex[2]!;
    if (hex.length === 4) hex = hex[0]! + hex[0]! + hex[1]! + hex[1]! + hex[2]! + hex[2]!;
    if (hex.length === 8) hex = hex.slice(0, 6);
    if (hex.length !== 6) return null;
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    return `#${hex.toUpperCase()}`;
}

/** Convert rgb(r,g,b) or rgba(r,g,b,a) to 6-digit hex. */
function rgbToHex(r: number, g: number, b: number): string {
    const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
    return `#${[clamp(r), clamp(g), clamp(b)].map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

const SKIP_COLORS = new Set([
    "#000000", "#FFFFFF", "#111111", "#222222", "#333333",
    "#EEEEEE", "#F0F0F0", "#FAFAFA", "#F5F5F5", "#DDDDDD",
    "#CCCCCC", "#BBBBBB", "#AAAAAA", "#999999", "#888888",
    "#777777", "#666666", "#555555", "#444444",
]);

/**
 * Extract hex/rgb color values from `<style>` blocks and inline `style=""` attrs.
 * Returns up to 20 unique 6-digit hex colors, ordered by frequency, with common
 * black/white/grays filtered out.
 */
function extractColorsFromHtml(html: string): string[] {
    const freq = new Map<string, number>();

    const addColor = (hex: string | null) => {
        if (!hex || SKIP_COLORS.has(hex)) return;
        freq.set(hex, (freq.get(hex) ?? 0) + 1);
    };

    // Collect content from <style> blocks
    const styleBlockRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let blockMatch: RegExpExecArray | null;
    const cssChunks: string[] = [];
    while ((blockMatch = styleBlockRe.exec(html)) !== null) {
        if (blockMatch[1]) cssChunks.push(blockMatch[1]);
    }

    // Collect inline style attributes
    const inlineRe = /style=["']([^"']*)["']/gi;
    let inlineMatch: RegExpExecArray | null;
    while ((inlineMatch = inlineRe.exec(html)) !== null) {
        if (inlineMatch[1]) cssChunks.push(inlineMatch[1]);
    }

    const css = cssChunks.join("\n");

    // Extract hex colors
    const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
    let hexMatch: RegExpExecArray | null;
    while ((hexMatch = hexRe.exec(css)) !== null) {
        addColor(normalizeHex(hexMatch[0]!));
    }

    // Extract rgb()/rgba() colors
    const rgbRe = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g;
    let rgbMatch: RegExpExecArray | null;
    while ((rgbMatch = rgbRe.exec(css)) !== null) {
        const r = parseInt(rgbMatch[1]!, 10);
        const g = parseInt(rgbMatch[2]!, 10);
        const b = parseInt(rgbMatch[3]!, 10);
        addColor(normalizeHex(rgbToHex(r, g, b)));
    }

    return [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([color]) => color);
}

/**
 * Extract candidate logo/icon URLs from HTML, ordered by quality (best first).
 * Resolves relative URLs against `baseUrl`.
 */
function extractIconUrls(html: string, baseUrl: string): string[] {
    const candidates: { url: string; priority: number }[] = [];

    const resolveUrl = (href: string): string | null => {
        try {
            return new URL(href, baseUrl).href;
        } catch {
            return null;
        }
    };

    // <link rel="apple-touch-icon" href="..."> (priority 1 — highest quality)
    const appleTouchRe = /<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = appleTouchRe.exec(html)) !== null) {
        const url = resolveUrl(m[1]!);
        if (url) candidates.push({ url, priority: 1 });
    }
    // Reversed attr order
    const appleTouchRe2 = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon[^"']*["']/gi;
    while ((m = appleTouchRe2.exec(html)) !== null) {
        const url = resolveUrl(m[1]!);
        if (url) candidates.push({ url, priority: 1 });
    }

    // <link rel="icon" type="image/png" href="..."> (priority 2)
    const iconPngRe = /<link[^>]+rel=["'](?:shortcut\s+)?icon["'][^>]+type=["']image\/png["'][^>]+href=["']([^"']+)["']/gi;
    while ((m = iconPngRe.exec(html)) !== null) {
        const url = resolveUrl(m[1]!);
        if (url) candidates.push({ url, priority: 2 });
    }

    // <link rel="icon" href="..."> (priority 3)
    const iconRe = /<link[^>]+rel=["'](?:shortcut\s+)?icon["'][^>]+href=["']([^"']+)["']/gi;
    while ((m = iconRe.exec(html)) !== null) {
        const url = resolveUrl(m[1]!);
        if (url) candidates.push({ url, priority: 3 });
    }
    const iconRe2 = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut\s+)?icon["']/gi;
    while ((m = iconRe2.exec(html)) !== null) {
        const url = resolveUrl(m[1]!);
        if (url) candidates.push({ url, priority: 3 });
    }

    // <meta property="og:image" content="..."> (priority 4)
    const ogImage = matchMeta(html, "property", "og:image");
    if (ogImage) {
        const url = resolveUrl(ogImage);
        if (url) candidates.push({ url, priority: 4 });
    }

    // /favicon.ico convention (priority 5)
    const faviconUrl = resolveUrl("/favicon.ico");
    if (faviconUrl) candidates.push({ url: faviconUrl, priority: 5 });

    // Deduplicate by URL, sort by priority
    const seen = new Set<string>();
    return candidates
        .sort((a, b) => a.priority - b.priority)
        .filter((c) => {
            if (seen.has(c.url)) return false;
            seen.add(c.url);
            return true;
        })
        .map((c) => c.url);
}

function extractPageSignals(html: string, baseUrl?: string): ExtractedPageSignals {
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

    const cssColors = extractColorsFromHtml(html);
    if (cssColors.length > 0) out.cssColors = cssColors;

    if (baseUrl) {
        const icons = extractIconUrls(html, baseUrl);
        const firstIcon = icons[0];
        if (firstIcon) out.iconUrl = firstIcon;
    }

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

const MAX_ICON_BYTES = 2 * 1024 * 1024; // 2 MiB limit for icon downloads
const ICON_TIMEOUT_MS = 10_000;

async function fetchIconBounded(url: string): Promise<{ blob: Blob } | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ICON_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            redirect: "follow",
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; VandaStudio/1.0; +https://vanda.studio)",
                Accept: "image/*",
            },
        });
        if (!res.ok) return null;
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.startsWith("image/")) return null;
        const buf = await res.arrayBuffer();
        if (buf.byteLength > MAX_ICON_BYTES || buf.byteLength < 100) return null;
        return { blob: new Blob([buf], { type: contentType }) };
    } catch {
        return null;
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
            "\nCrie uma identidade de marca COMPLETA e RICA em português brasileiro. Preencha TODOS os campos do JSON. Cores em hex.";

        const system = `Você é um estrategista sênior de marca e diretor criativo para redes sociais. Sua missão é criar identidades de marca memoráveis e completas.

RETORNE APENAS JSON VÁLIDO seguindo o schema. Preencha TODOS os campos — nenhum deve ficar vazio.

DIRETRIZES POR CAMPO:
- elevatorPitch: Frase poderosa que captura a essência da marca. Deve ser memorável.
- whatWeSell: Descreva produtos/serviços com especificidade — formatos, categorias, faixa.
- whoWeServe: Perfil DETALHADO do público: idade, estilo de vida, valores, dores, aspirações. NUNCA diga "público geral".
- differentiators: O que torna esta marca DIFERENTE? Cite vantagens concretas vs concorrentes. Não repita o pitch.
- competitorsNotes: Cite o cenário competitivo real, oportunidades de posicionamento.
- toneAdjectives: 4-6 adjetivos de personalidade verbal (não genéricos como "profissional").
- writingRules: 3-5 regras ACIONÁVEIS para redatores com exemplos de FAÇA/NÃO FAÇA.
- emojiPolicy: Como, quando e quais emojis usar — com exemplos concretos.
- ctaStyle: Tom e exemplos de CTAs típicas da marca.
- primaryColors: 3-5 cores hex que formem uma paleta ÚNICA e coerente com a personalidade da marca. Evite paletas óbvias/clichê do setor.
- secondaryColors: 2-4 cores de apoio que complementem.
- typographyPrimary: Nome EXATO de uma família do Google Fonts para títulos. Escolha uma fonte com personalidade que reflita a marca.
- typographySecondary: Nome EXATO de uma família do Google Fonts para corpo. Deve harmonizar com a primária.
- imageryGuidelines: Estilo visual detalhado — iluminação, composição, mood, referências estéticas.

${BREVITY_RULE}`;

        return await runAiEffectOrThrow(
            Effect.gen(function* () {
                const textGen = yield* TextGeneration;
                return yield* textGen.generateStructured({
                    messages: [
                        { role: "system", content: system },
                        { role: "user", content: userPrompt },
                    ],
                    schema: BrandKitSuggestionSchema,
                    model: BRAND_ONBOARDING_MODEL,
                    temperature: 0.75,
                    maxTokens: 4096,
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
                "\nSugira apenas posicionamento: elevatorPitch, whatWeSell, whoWeServe, differentiators, competitorsNotes (todos opcionais no JSON). pt-BR. Cada texto: poucas frases; não liste públicos infinitos em whoWeServe.";
            const system = `Você é estrategista de marca. Responda só com JSON válido para o schema pedido. ${BREVITY_RULE}`;
            return await runAiEffectOrThrow(
                Effect.gen(function* () {
                    const textGen = yield* TextGeneration;
                    return yield* textGen.generateStructured({
                        messages: [
                            { role: "system", content: system },
                            { role: "user", content: userPrompt },
                        ],
                        schema: PositioningSectionSchema,
                        model: BRAND_ONBOARDING_MODEL,
                        temperature: 0.7,
                        maxTokens: 2048,
                    });
                })
            );
        }

        if (args.section === "voice") {
            userPrompt +=
                "\nSugira apenas voz/estilo verbal: toneAdjectives, writingRules, languages, emojiPolicy, ctaStyle. pt-BR. JSON. Listas curtas.";
            const system = `Você é redator de marca. Responda só com JSON válido para o schema pedido. ${BREVITY_RULE}`;
            return await runAiEffectOrThrow(
                Effect.gen(function* () {
                    const textGen = yield* TextGeneration;
                    return yield* textGen.generateStructured({
                        messages: [
                            { role: "system", content: system },
                            { role: "user", content: userPrompt },
                        ],
                        schema: VoiceSectionSchema,
                        model: BRAND_ONBOARDING_MODEL,
                        temperature: 0.75,
                        maxTokens: 2048,
                    });
                })
            );
        }

        userPrompt +=
            "\nSugira apenas identidade visual: primaryColors, secondaryColors (hex), typographyPrimary, typographySecondary, imageryGuidelines. JSON. Poucas cores e frases.";
        const system = `Você é designer de marca. Responda só com JSON válido para o schema pedido. ${BREVITY_RULE}`;
        return await runAiEffectOrThrow(
            Effect.gen(function* () {
                const textGen = yield* TextGeneration;
                return yield* textGen.generateStructured({
                    messages: [
                        { role: "system", content: system },
                        { role: "user", content: userPrompt },
                    ],
                    schema: VisualSectionSchema,
                    model: BRAND_ONBOARDING_MODEL,
                    temperature: 0.65,
                    maxTokens: 2048,
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
        logoStorageId?: Id<"_storage">;
        logoUrl?: string;
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

        const signals = extractPageSignals(html, safeUrl.origin);
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

        const cssColorBlock = signals.cssColors?.length
            ? `\n\n## Cores encontradas no CSS da página\n${signals.cssColors.join(", ")}\n\nIMPORTANTE: Use estas cores REAIS extraídas do site como base para definir primaryColors e secondaryColors. NÃO invente cores — escolha entre as que aparecem acima. Priorize as cores mais vibrantes e distintas que representam a identidade visual da marca.`
            : "";

        const userPrompt = `## URL\n${safeUrl.href}\n\n## Meta / cabeçalho\n${metaBlock || "(nenhum)"}${cssColorBlock}\n\n## Amostra de texto da página\n${textSample}\n\nCom base nisso, infira um kit de marca em pt-BR. Para cores, use EXCLUSIVAMENTE as cores encontradas no CSS acima (se disponíveis). Campos desconhecidos podem ser omitidos.`;

        const system = `Você analisa sites e propõe identidade de marca para redes sociais.
Retorne JSON no schema: elevatorPitch, whatWeSell, whoWeServe, differentiators, competitorsNotes,
toneAdjectives[], writingRules, languages[], emojiPolicy, ctaStyle,
primaryColors[], secondaryColors[], typographyPrimary, typographySecondary, imageryGuidelines.
Não invente fatos específicos não suportados pelo texto; prefira inferências modestas.
REGRA DE CORES: Se cores CSS foram fornecidas, use APENAS elas para primaryColors e secondaryColors. Não invente cores. ${BREVITY_RULE}`;

        const suggestion = await runAiEffectOrThrow(
            Effect.gen(function* () {
                const textGen = yield* TextGeneration;
                return yield* textGen.generateStructured({
                    messages: [
                        { role: "system", content: system },
                        { role: "user", content: userPrompt },
                    ],
                    schema: BrandKitSuggestionSchema,
                    model: BRAND_ONBOARDING_MODEL,
                    temperature: 0.55,
                    maxTokens: 4096,
                });
            })
        );

        // Attempt to download and store the best icon/logo from the site
        let logoStorageId: Id<"_storage"> | undefined;
        let logoUrl: string | undefined;
        if (signals.iconUrl) {
            try {
                const iconResponse = await fetchIconBounded(signals.iconUrl);
                if (iconResponse) {
                    logoStorageId = await ctx.storage.store(iconResponse.blob);
                    logoUrl = (await ctx.storage.getUrl(logoStorageId)) ?? undefined;
                }
            } catch {
                warnings.push("Não foi possível baixar o ícone/logo do site.");
            }
        }

        return {
            suggestion,
            warnings,
            signals,
            ...(logoStorageId ? { logoStorageId } : {}),
            ...(logoUrl ? { logoUrl } : {}),
        };
    },
});

// ============================================================================
// Instagram brand inference (lightweight — no posts stored)
// ============================================================================

const APIFY_DEFAULT_ACTOR_ID = "shu8hvrXbJbY3Eb9W";
const IG_CAPTION_LIMIT = 20;
const IG_CAPTION_CHARS = 8_000;

function normalizeInstagramUrl(rawUrl: string): string {
    const trimmed = rawUrl.trim();
    const formatHandle = (value: string) => value.replace(/^@/, "").split(/[/?]/)[0] ?? "";
    if (!trimmed.startsWith("http")) {
        const handle = formatHandle(trimmed);
        return handle ? `https://www.instagram.com/${handle}/` : "https://www.instagram.com/";
    }
    try {
        const url = new URL(trimmed);
        const [handle] = url.pathname.split("/").filter(Boolean);
        return handle ? `https://www.instagram.com/${handle}/` : "https://www.instagram.com/";
    } catch {
        const handle = formatHandle(trimmed);
        return handle ? `https://www.instagram.com/${handle}/` : "https://www.instagram.com/";
    }
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function igCoalesce<T>(...values: (T | null | undefined)[]): T | undefined {
    for (const v of values) {
        if (v !== undefined && v !== null) return v;
    }
    return undefined;
}

export const ingestInstagramForBrand = action({
    args: {
        instagramUrl: v.string(),
    },
    handler: async (
        ctx,
        args
    ): Promise<{
        suggestion: BrandKitSuggestion;
        warnings: string[];
        profileData: { handle?: string; bio?: string; profilePicUrl?: string };
    }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Você precisa estar autenticado");
        }

        const token = process.env.APIFY_API_TOKEN ?? process.env.APIFY_TOKEN;
        if (!token) {
            throw new Error("Token Apify não configurado (contate o suporte)");
        }

        const warnings: string[] = [];
        const apify = new ApifyClient({ token });
        const normalizedUrl = normalizeInstagramUrl(args.instagramUrl);
        const actorId = process.env.APIFY_INSTAGRAM_ACTOR_ID ?? APIFY_DEFAULT_ACTOR_ID;

        const run = await apify.actor(actorId).call({
            directUrls: [normalizedUrl],
            resultsType: "posts",
            resultsLimit: IG_CAPTION_LIMIT,
            addParentData: true,
            searchType: "user",
        });

        if (!run.defaultDatasetId) {
            throw new Error("Apify não retornou dados para esse perfil");
        }

        const { items } = await apify.dataset(run.defaultDatasetId).listItems({ clean: true });
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        const datasetItems = (items as Record<string, any>[]) ?? [];

        if (datasetItems.length === 0) {
            throw new Error("Nenhum dado encontrado para esse perfil do Instagram");
        }

        const first = datasetItems[0] ?? {};
        const owner = first.owner ?? first.ownerObject ?? {};
        const meta = first.metaData ?? first.metadata ?? {};

        const handle = igCoalesce<string>(
            meta.username, first.username, owner.username, first.ownerUsername,
        );
        const bio = igCoalesce<string>(
            owner.biography, first.ownerBiography, first.biography, meta.biography,
        );
        const profilePicUrl = igCoalesce<string>(
            owner.profilePicUrl, owner.profilePicUrlHd, owner.profilePictureUrl,
            first.ownerProfilePicUrl, first.profilePicUrl, meta.profilePicUrl,
        );

        const captions = datasetItems
            .map((item) => igCoalesce<string>(item.caption, item.description, item.title))
            .filter((c): c is string => !!c && c.trim().length > 10);

        let captionBlock = captions.slice(0, IG_CAPTION_LIMIT).join("\n---\n");
        if (captionBlock.length > IG_CAPTION_CHARS) {
            captionBlock = captionBlock.slice(0, IG_CAPTION_CHARS);
            warnings.push("Legendas truncadas por limite de tamanho.");
        }
        if (captions.length === 0) {
            warnings.push("Nenhuma legenda encontrada; resultados podem ser limitados.");
        }

        const parts: string[] = [];
        if (handle) parts.push(`Perfil: @${handle}`);
        if (bio) parts.push(`Bio: ${bio}`);
        if (captionBlock) parts.push(`Legendas recentes:\n${captionBlock}`);

        const userPrompt = `## Perfil do Instagram\n${parts.join("\n\n")}\n\nCom base no perfil e legendas, infira um kit de marca completo em pt-BR. Use cores em hex quando possível. Campos desconhecidos podem ser omitidos.`;

        const system = `Você analisa perfis de Instagram e propõe identidade de marca para redes sociais.
Retorne JSON no schema: elevatorPitch, whatWeSell, whoWeServe, differentiators, competitorsNotes,
toneAdjectives[], writingRules, languages[], emojiPolicy, ctaStyle,
primaryColors[], secondaryColors[], typographyPrimary, typographySecondary, imageryGuidelines.
Não invente fatos específicos não suportados pelas legendas; prefira inferências modestas. ${BREVITY_RULE}`;

        const suggestion = await runAiEffectOrThrow(
            Effect.gen(function* () {
                const textGen = yield* TextGeneration;
                return yield* textGen.generateStructured({
                    messages: [
                        { role: "system", content: system },
                        { role: "user", content: userPrompt },
                    ],
                    schema: BrandKitSuggestionSchema,
                    model: BRAND_ONBOARDING_MODEL,
                    temperature: 0.6,
                    maxTokens: 4096,
                });
            })
        );

        return {
            suggestion,
            warnings,
            profileData: {
                ...(handle ? { handle } : {}),
                ...(bio ? { bio } : {}),
                ...(profilePicUrl ? { profilePicUrl } : {}),
            },
        };
    },
});
