/**
 * Preset post layout templates for guided image generation.
 * Preview assets live in /static/templates/ (served as /templates/*.png).
 * Convex resolves absolute URLs via getTemplateReferencePublicUrl().
 */

/** Stable id sent to Convex `templateId` and stored in session */
export type PostTemplateId = string;

/** Where the template appears: post composer vs /images studio */
export type TemplateSurface = "post" | "image";

export interface PostTemplate {
    id: PostTemplateId;
    title: string;
    shortDescription: string;
    /** Path for <img src> in the app (SvelteKit static) */
    previewPath: string;
    /** Filename under static/templates/ (first / default slide) */
    referenceFile: string;
    /**
     * Ordered layout reference files per carousel slide (automation slide count = length).
     * When omitted, treated as [referenceFile] (single slide).
     */
    referenceFiles?: string[];
    /** Defaults to both surfaces when omitted */
    surfaces?: TemplateSurface[];
    /** Instructions for the image model — aligns with template PNG (template-first) */
    visionPrompt: string;
}

/** Shared instructions for Canva-style carousel slide references. */
export const CAROUSEL_SLIDE_VISION_BASE = `Instagram carousel marketing slide (portrait ~4:5). The attached image is THE template slide to match.

Reproduce the same visual language as the reference:
- Color blocks, background fills, accent colors, and contrast
- Shapes, lines, icons, dividers, corners, and decorative elements
- Typography hierarchy, weights, casing, and approximate scale (headline vs subhead vs body vs CTA vs bullets)
- Spacing, alignment, and padding rhythm

The brand brief may describe subject matter or tone for the *content*, but the LOOK of the slide should follow this reference closely.

All on-image text must be Brazilian Portuguese from the user instructions only — never copy headlines, slogans, bullets, or button labels from the reference image.
Polished professional social feed design matching the pack.`;

/** Appended per slide for automation so the model knows carousel position and narrative role. */
export function carouselSlideVisionSuffix(slideIndex: number, totalSlides: number): string {
    return `\n\nEste é o slide ${slideIndex + 1} de ${totalSlides} em um carrossel; o conteúdo visual e textual deve avançar a narrativa conforme o prompt deste slide do usuário.`;
}

/** Full vision string for one carousel slide (automation or single-gen with first ref only). */
export function buildCarouselSlideVisionPrompt(
    slideIndex: number,
    totalSlides: number
): string {
    return `${CAROUSEL_SLIDE_VISION_BASE}${carouselSlideVisionSuffix(slideIndex, totalSlides)}`;
}

const CAROUSEL_SLIDE_VISION = buildCarouselSlideVisionPrompt(0, 1);

/** Five-slide automation using the same pack PNG per slide until per-slide assets exist. */
function carouselRefs(file: string): string[] {
    return [file, file, file, file, file];
}

export const POST_TEMPLATES: PostTemplate[] = [
    {
        id: "editorial-minimal",
        title: "Editorial minimal",
        shortDescription: "Fundo neutro, tipografia forte, muito espaço em branco.",
        previewPath: "/templates/editorial-minimal.png",
        referenceFile: "editorial-minimal.png",
        visionPrompt: `Minimalist editorial Instagram post (portrait ~4:5). Match the reference: solid light greige / warm neutral background filling the frame. Strict LEFT alignment for all text blocks with generous negative space on the right and top/bottom.
Typography hierarchy as in the template: one large elegant high-contrast SERIF headline (magazine/editorial feel). Below it, body in clean modern SANS-SERIF, ALL CAPS, medium weight. Optional second paragraph in the same sans, BOLD ITALIC all-caps for emphasis.
Color: deep chocolate / earthy brown for all type and small UI accents — monochromatic with the background, as shown.
Optional small circular control at bottom corner: solid dark brown circle with tiny white chevron — only if it fits; omit if cluttered.
Do NOT reproduce any words from the reference image. Use ONLY text supplied in user instructions (pt-BR). Match roles: headline vs body vs emphasis.`,
    },
    {
        id: "lifestyle-photo-overlay",
        title: "Foto + faixa",
        shortDescription: "Foto full-bleed com faixa superior e stack tipográfico central.",
        previewPath: "/templates/lifestyle-photo-overlay.png",
        referenceFile: "lifestyle-photo-overlay.png",
        visionPrompt: `Lifestyle photograph as full-bleed background (soft focus, warm neutrals — cream, beige, brown) with CENTERED typographic stack — match the reference mood and color grade.

Top: compact horizontal BANNER — dark brown rectangle with subtle decorative border (e.g. dashed/stitched look). Inside: short hook in bold white ALL-CAPS sans-serif.

Below the banner: large main headline in elegant white SERIF, italic, subtle drop shadow for readability on photo. Under that, smaller subline in the same white serif italic.

Bottom center: small handle / brand line in clean white sans (from user instructions only).

Place text over the calmest area of the image so faces or products stay readable. Photo subject and setting may reflect Diretrizes de imagem (e.g. SST professionals, workspace) while keeping this template's warm overlay aesthetic.

Do NOT copy literal text from the reference. All copy from user instructions (pt-BR).`,
    },
    {
        id: "split-text-left",
        title: "Texto à esquerda",
        shortDescription: "Metade texto, metade foto — painel à esquerda.",
        previewPath: "/templates/split-text-left.png",
        referenceFile: "split-text-left.png",
        visionPrompt: `Vertical split — LEFT ~40% clean off-white panel for text, RIGHT ~60% lifestyle photo — match the reference's warm neutrals and soft natural light.

Left panel: large italic SERIF title in deep chocolate brown. Below, ALL-CAPS sans-serif body in a slightly lighter brown; end with a short bold segment for emphasis (same sans, bold).

Bottom left: optional small circular dark brown button with white chevron (carousel hint).

Right side: photographic subject with premium authentic feel; neutral wall / background as in template. Subject may follow Diretrizes de imagem (e.g. medicina do trabalho context).

All on-image text from user instructions (pt-BR). Do not copy reference wording.`,
    },
    {
        id: "split-text-right",
        title: "Texto à direita",
        shortDescription: "Foto à esquerda, coluna de texto à direita.",
        previewPath: "/templates/split-text-right.png",
        referenceFile: "split-text-right.png",
        visionPrompt: `Vertical composition: lifestyle photography on the LEFT, clear text-safe zone on the RIGHT — warm neutrals, soft light, matching the reference.

Typography: main headline in stylish italic SERIF, deep chocolate brown, aligned to the text column. Body below in bold clean SANS, ALL CAPS, same brown family.

Bottom corner on text side: optional small dark brown circle with white chevron.

Photo leaves intentional negative space toward the text side. Subject may reflect Diretrizes de imagem while keeping the template's palette and type pairing.

All copy from user instructions (pt-BR). Do not replicate reference strings.`,
    },
    {
        id: "photo-with-footer-bar",
        title: "Foto + rodapé",
        shortDescription: "Imagem em destaque e faixa inferior com mensagem.",
        previewPath: "/templates/photo-with-footer-bar.png",
        referenceFile: "photo-with-footer-bar.png",
        visionPrompt: `Upper ~75–80% hero lifestyle photo (bright, soft light, neutral background) — match reference. Optional large thin-line script or monogram-like graphic in muted taupe behind the subject as subtle watermark — very light, not competing.

Bottom ~20–25%: solid opaque CHOCOLATE BROWN footer band spanning full width.

Footer typography: centered elegant high-contrast SERIF in WHITE (Didot/Playfair-like), 1–3 lines, editorial spacing. Message only from user (pt-BR).

Overall palette: greige, taupe, chocolate brown, white type on footer — as in template. Scene/subject may follow Diretrizes de imagem.

Do not copy reference wording.`,
    },
    {
        id: "carrossel-c01-dicas-bege",
        title: "Carrossel · dicas bege",
        shortDescription: "Retrato elegante bege — dicas para redes.",
        previewPath: "/templates/carrossel-c01-dicas-bege.png",
        referenceFile: "carrossel-c01-dicas-bege.png",
        referenceFiles: carouselRefs("carrossel-c01-dicas-bege.png"),
        surfaces: ["post"],
        visionPrompt: CAROUSEL_SLIDE_VISION,
    },
    {
        id: "carrossel-c02-yellow-bw-microblog",
        title: "Carrossel · amarelo e preto",
        shortDescription: "Microblog moderno (amarelo, branco, preto).",
        previewPath: "/templates/carrossel-c02-yellow-bw-microblog.png",
        referenceFile: "carrossel-c02-yellow-bw-microblog.png",
        referenceFiles: carouselRefs("carrossel-c02-yellow-bw-microblog.png"),
        surfaces: ["post"],
        visionPrompt: CAROUSEL_SLIDE_VISION,
    },
    {
        id: "carrossel-c03-neutro-minimalista",
        title: "Carrossel · neutro minimalista",
        shortDescription: "Conteúdo social clean neutro.",
        previewPath: "/templates/carrossel-c03-neutro-minimalista.png",
        referenceFile: "carrossel-c03-neutro-minimalista.png",
        referenceFiles: carouselRefs("carrossel-c03-neutro-minimalista.png"),
        surfaces: ["post"],
        visionPrompt: CAROUSEL_SLIDE_VISION,
    },
    {
        id: "carrossel-c04-marketing-verde",
        title: "Carrossel · marketing verde",
        shortDescription: "Estratégias de marketing, verde moderno.",
        previewPath: "/templates/carrossel-c04-marketing-verde.png",
        referenceFile: "carrossel-c04-marketing-verde.png",
        referenceFiles: carouselRefs("carrossel-c04-marketing-verde.png"),
        surfaces: ["post"],
        visionPrompt: CAROUSEL_SLIDE_VISION,
    },
    {
        id: "carrossel-c05-teal-remote",
        title: "Carrossel · teal remoto",
        shortDescription: "How-to / trabalho remoto, teal.",
        previewPath: "/templates/carrossel-c05-teal-remote.png",
        referenceFile: "carrossel-c05-teal-remote.png",
        referenceFiles: carouselRefs("carrossel-c05-teal-remote.png"),
        surfaces: ["post"],
        visionPrompt: CAROUSEL_SLIDE_VISION,
    },
    {
        id: "carrossel-c06-bege-branco",
        title: "Carrossel · bege e branco",
        shortDescription: "Retrato elegante bege e branco.",
        previewPath: "/templates/carrossel-c06-bege-branco.png",
        referenceFile: "carrossel-c06-bege-branco.png",
        referenceFiles: carouselRefs("carrossel-c06-bege-branco.png"),
        surfaces: ["post"],
        visionPrompt: CAROUSEL_SLIDE_VISION,
    },
    {
        id: "carrossel-c07-consultoria",
        title: "Carrossel · consultoria",
        shortDescription: "Negócios — verde, azul e branco.",
        previewPath: "/templates/carrossel-c07-consultoria.png",
        referenceFile: "carrossel-c07-consultoria.png",
        referenceFiles: carouselRefs("carrossel-c07-consultoria.png"),
        surfaces: ["post"],
        visionPrompt: CAROUSEL_SLIDE_VISION,
    },
    {
        id: "carrossel-c08-amor-proprio-creme",
        title: "Carrossel · amor-próprio creme",
        shortDescription: "Minimalista creme.",
        previewPath: "/templates/carrossel-c08-amor-proprio-creme.png",
        referenceFile: "carrossel-c08-amor-proprio-creme.png",
        referenceFiles: carouselRefs("carrossel-c08-amor-proprio-creme.png"),
        surfaces: ["post"],
        visionPrompt: CAROUSEL_SLIDE_VISION,
    },
    {
        id: "carrossel-c09-bw-gold-speaking",
        title: "Carrossel · ouro e palestra",
        shortDescription: "Preto, branco e dourado — speaking.",
        previewPath: "/templates/carrossel-c09-bw-gold-speaking.png",
        referenceFile: "carrossel-c09-bw-gold-speaking.png",
        referenceFiles: carouselRefs("carrossel-c09-bw-gold-speaking.png"),
        surfaces: ["post"],
        visionPrompt: CAROUSEL_SLIDE_VISION,
    },
    {
        id: "carrossel-c10-marketing-branco-azul",
        title: "Carrossel · branco e azul",
        shortDescription: "Marketing digital branco e azul.",
        previewPath: "/templates/carrossel-c10-marketing-branco-azul.png",
        referenceFile: "carrossel-c10-marketing-branco-azul.png",
        referenceFiles: carouselRefs("carrossel-c10-marketing-branco-azul.png"),
        surfaces: ["post"],
        visionPrompt: CAROUSEL_SLIDE_VISION,
    },
];

const POST_TEMPLATE_BY_ID = new Map(POST_TEMPLATES.map((t) => [t.id, t]));

export function getPostTemplateById(id: string): PostTemplate | undefined {
    return POST_TEMPLATE_BY_ID.get(id);
}

const DEFAULT_SURFACES: TemplateSurface[] = ["post", "image"];

export function getPostTemplateSurfaces(template: PostTemplate): TemplateSurface[] {
    return template.surfaces?.length ? template.surfaces : DEFAULT_SURFACES;
}

/** Ordered reference filenames for layout URLs (automation slide count = length). */
export function getPostTemplateReferenceFiles(template: PostTemplate): string[] {
    if (template.referenceFiles?.length) {
        return template.referenceFiles;
    }
    return [template.referenceFile];
}

/** Templates shown in the post composer (excludes image-only carousels from /images picker). */
export const POST_TEMPLATES_FOR_COMPOSER: PostTemplate[] = POST_TEMPLATES.filter((t) =>
    getPostTemplateSurfaces(t).includes("post")
);

/** Templates available in /images molduras picker */
export const POST_TEMPLATES_FOR_IMAGE_STUDIO: PostTemplate[] = POST_TEMPLATES.filter((t) =>
    getPostTemplateSurfaces(t).includes("image")
);

/** Convex / server: absolute URL to fetch template reference image */
export function getTemplateReferencePublicUrl(baseUrl: string, referenceFile: string): string {
    const base = baseUrl.replace(/\/$/, "");
    return `${base}/templates/${referenceFile}`;
}
