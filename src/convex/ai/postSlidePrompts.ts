"use node";

import { z } from "zod";
import { Effect } from "effect";
import { TextGeneration, MODELS, runAiEffectOrThrow } from "./llm/index";

const SlidePromptsSchema = z.object({
    slides: z.array(z.string().max(4000)).min(1).max(10),
});

function normalizeSlidePrompts(raw: string[], slideCount: number, fallbackBrief: string): string[] {
    const brief = fallbackBrief.trim();
    if (slideCount <= 1) {
        return [brief];
    }
    let slides = raw.map((s) => s.trim()).filter(Boolean);
    if (slides.length === 0) {
        return Array.from({ length: slideCount }, () => brief);
    }
    if (slides.length < slideCount) {
        const last = slides[slides.length - 1] ?? brief;
        while (slides.length < slideCount) {
            slides.push(last);
        }
    } else if (slides.length > slideCount) {
        slides = slides.slice(0, slideCount);
    }
    return slides;
}

/**
 * Split a post brief into one image prompt per carousel slide (structured LLM).
 * When slideCount === 1, returns [brief] without calling the model.
 */
export async function splitPostBriefIntoSlidePrompts(args: {
    brief: string;
    slideCount: number;
    templateTitle?: string;
}): Promise<string[]> {
    const { brief, slideCount, templateTitle } = args;
    if (slideCount <= 1) {
        return [brief.trim()];
    }

    const trimmed = brief.trim();
    if (!trimmed) {
        return Array.from({ length: slideCount }, () => "");
    }

    const system = `You split a social media post brief into exactly ${slideCount} separate image-generation prompts for an Instagram carousel.
Each prompt must be self-contained: describe only what belongs on that slide (visuals, hierarchy, and what text roles appear — not final copy unless the brief specifies exact phrases).
Return a single JSON object with one key "slides" whose value is a JSON array of exactly ${slideCount} strings.
All string values must be Brazilian Portuguese (pt-BR). Do not prefix slides with "Slide 1:" etc.`;

    const user = templateTitle
        ? `## Pacote de layout\n${templateTitle}\n\n## Brief do post\n${trimmed}`
        : `## Brief do post\n${trimmed}`;

    const out = await runAiEffectOrThrow(
        Effect.gen(function* () {
            const textGen = yield* TextGeneration;
            return yield* textGen.generateStructured({
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: user },
                ],
                schema: SlidePromptsSchema,
                model: MODELS.KIMI_K2,
                temperature: 0.45,
                maxTokens: 8192,
            });
        })
    );

    return normalizeSlidePrompts(out.slides, slideCount, trimmed);
}
