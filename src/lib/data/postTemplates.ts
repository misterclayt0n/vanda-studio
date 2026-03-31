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
    /**
     * Optional per-slide preview URLs (same length as `referenceFiles` when set).
     * Use when each carousel slide has its own PNG under `/templates/…`.
     */
    previewSlidePaths?: string[];
}

/**
 * Carrossel: uma frase curta — o PNG já carrega layout, cores e hierarquia.
 * O bloco PACEFF em `image.ts` cobre o resto.
 */
export const CAROUSEL_SLIDE_VISION_BASE = `Slide de carrossel Instagram (~4:5). A imagem anexa é o modelo de layout e estilo; replique a estrutura. Textos em pt-BR só a partir do prompt do usuário — não copie palavras do PNG.`;

/** Appended per slide for automation so the model knows carousel position and narrative role. */
export function carouselSlideVisionSuffix(slideIndex: number, totalSlides: number): string {
    return `\n\nSlide ${slideIndex + 1} de ${totalSlides}: use o prompt deste slide para o conteúdo.`;
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
        visionPrompt: "",
    },
    {
        id: "lifestyle-photo-overlay",
        title: "Foto + faixa",
        shortDescription: "Foto full-bleed com faixa superior e stack tipográfico central.",
        previewPath: "/templates/lifestyle-photo-overlay.png",
        referenceFile: "lifestyle-photo-overlay.png",
        visionPrompt: "",
    },
    {
        id: "split-text-left",
        title: "Texto à esquerda",
        shortDescription: "Metade texto, metade foto — painel à esquerda.",
        previewPath: "/templates/split-text-left.png",
        referenceFile: "split-text-left.png",
        visionPrompt: "",
    },
    {
        id: "split-text-right",
        title: "Texto à direita",
        shortDescription: "Foto à esquerda, coluna de texto à direita.",
        previewPath: "/templates/split-text-right.png",
        referenceFile: "split-text-right.png",
        visionPrompt: "",
    },
    {
        id: "photo-with-footer-bar",
        title: "Foto + rodapé",
        shortDescription: "Imagem em destaque e faixa inferior com mensagem.",
        previewPath: "/templates/photo-with-footer-bar.png",
        referenceFile: "photo-with-footer-bar.png",
        visionPrompt: "",
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

/** One preview URL per slide for the molduras picker (distinct art when `previewSlidePaths` is set). */
export function getTemplateSlidePreviewUrls(template: PostTemplate): string[] {
    const files = getPostTemplateReferenceFiles(template);
    if (template.previewSlidePaths && template.previewSlidePaths.length === files.length) {
        return template.previewSlidePaths;
    }
    return files.map((f) => `/templates/${f}`);
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
