/**
 * Preset post layout templates for guided image generation.
 * Preview assets live in /static/templates/ (served as /templates/*.png).
 * Convex resolves absolute URLs via getTemplateReferencePublicUrl().
 */

/** Stable id sent to Convex `templateId` and stored in session */
export type PostTemplateId = string;

export interface PostTemplate {
    id: PostTemplateId;
    title: string;
    shortDescription: string;
    /** Path for <img src> in the app (SvelteKit static) */
    previewPath: string;
    /** Filename under static/templates/ */
    referenceFile: string;
    /** Instructions for the image model: layout, type, palette — not literal copy from reference */
    visionPrompt: string;
}

/** Shared instructions for Canva-style carousel slide references (each pack's first slide PNG). */
const CAROUSEL_SLIDE_VISION = `Instagram carousel marketing slide (portrait ~4:5). The attached image is the FIRST slide of a carousel pack.
Recreate the same design language: color blocks, shapes, lines, icons, typography hierarchy, spacing, and alignment from the reference.
Keep the same overall palette family and contrast (accents, neutrals, dark/light balance) — do not invent a totally different brand system.
All on-image text must be Brazilian Portuguese from the user instructions only — never copy headlines, slogans, bullets, or button labels from the reference.
Match typographic ROLES (main headline, subhead, body, CTA) and approximate scale/placement. Polished professional social feed design.`;

export const POST_TEMPLATES: PostTemplate[] = [
    {
        id: "editorial-minimal",
        title: "Editorial minimal",
        shortDescription: "Fundo neutro, tipografia forte, muito espaço em branco.",
        previewPath: "/templates/editorial-minimal.png",
        referenceFile: "editorial-minimal.png",
        visionPrompt: `Layout reference: minimalist editorial Instagram post (portrait ~4:5).
Solid light greige / warm neutral background filling the frame. Strict LEFT alignment for all text blocks with generous negative space on the right and top/bottom.
Typography hierarchy: one large elegant high-contrast SERIF headline (magazine/editorial feel, slightly tight tracking). Below it, body copy in a clean modern SANS-SERIF, ALL CAPS, medium weight with comfortable line length. Optional second paragraph in the same sans but BOLD ITALIC all-caps for emphasis.
Color: single deep chocolate / earthy brown for all type and small UI accents — monochromatic with the background.
Optional small circular control at bottom corner: solid dark brown circle with a tiny white chevron (carousel cue) — include only if it fits the composition; omit if cluttered.
Do NOT reproduce any words from the reference image. Use ONLY the headline, body, and emphasis text supplied in the user instructions (Brazilian Portuguese). Match the visual role of each text block (headline vs body vs emphasis) to the reference layout.`,
    },
    {
        id: "lifestyle-photo-overlay",
        title: "Foto + faixa",
        shortDescription: "Foto de lifestyle com título em caixa e serif central.",
        previewPath: "/templates/lifestyle-photo-overlay.png",
        referenceFile: "lifestyle-photo-overlay.png",
        visionPrompt: `Layout reference: lifestyle photograph as full-bleed background (soft focus, warm neutrals — cream, beige, brown) with CENTERED typographic stack.
Top: a compact horizontal BANNER — dark brown rectangle with subtle decorative border (e.g. dashed/stitched look). Inside the banner: short hook text in bold white ALL-CAPS sans-serif.
Below the banner: large main headline in elegant white SERIF, italic, with subtle drop shadow for readability on photo. Under that, a smaller subline in the same white serif italic.
Bottom center: small handle / brand line in clean white sans (from user instructions only).
Place text over the calmest area of the image (e.g. furniture, negative space) so faces or products stay readable.
Do NOT copy literal text from the reference. Use only copy from the user instructions (pt-BR).`,
    },
    {
        id: "split-text-left",
        title: "Texto à esquerda",
        shortDescription: "Metade texto, metade foto — título serif à esquerda.",
        previewPath: "/templates/split-text-left.png",
        referenceFile: "split-text-left.png",
        visionPrompt: `Layout reference: vertical split — LEFT ~40% clean off-white panel for text, RIGHT ~60% lifestyle photo (person, workspace, soft natural light, warm neutrals).
Left panel: large italic SERIF title in deep chocolate brown. Below, block of ALL-CAPS sans-serif body in a slightly lighter brown; end with a short bold segment for emphasis (same sans, bold).
Bottom left: optional small circular dark brown button with white chevron (carousel hint).
Right side: photographic subject cropped to feel premium and authentic; background wall neutral.
Do NOT copy wording from the reference. All on-image text must come from the user instructions (pt-BR).`,
    },
    {
        id: "split-text-right",
        title: "Texto à direita",
        shortDescription: "Foto à esquerda, bloco editorial à direita.",
        previewPath: "/templates/split-text-right.png",
        referenceFile: "split-text-right.png",
        visionPrompt: `Layout reference: vertical composition with lifestyle photography on the LEFT and a clear text-safe zone on the RIGHT (or text anchored right with photo occupying the opposite side). Warm neutrals, soft light.
Typography: main headline in stylish italic SERIF, deep chocolate brown, right-aligned or aligned to the text column. Body below in bold clean SANS, ALL CAPS, same brown family.
Bottom corner on the text side: optional small dark brown circle with white chevron.
Photo should leave intentional negative space toward the text side. Subject can be workspace / torso / laptop — premium casual brand feel.
All copy from user instructions only (pt-BR). Do not replicate reference strings.`,
    },
    {
        id: "photo-with-footer-bar",
        title: "Foto + rodapé",
        shortDescription: "Imagem em destaque e faixa inferior com mensagem.",
        previewPath: "/templates/photo-with-footer-bar.png",
        referenceFile: "photo-with-footer-bar.png",
        visionPrompt: `Layout reference: upper ~75–80% hero lifestyle photo (bright, soft light, neutral background). Optional large thin-line script or monogram-like graphic in muted taupe behind the subject as subtle watermark — keep very light, not competing with subject.
Bottom ~20–25%: solid opaque CHOCOLATE BROWN footer band spanning full width.
Footer typography: centered elegant high-contrast SERIF in WHITE (Didot/Playfair-like), 1–3 lines, editorial spacing. Message must be supplied by user (pt-BR) — not the reference text.
Overall palette: greige, taupe, chocolate brown, white type on footer.
Do not copy reference wording.`,
    },
    {
        id: "carrossel-c01-dicas-bege",
        title: "Carrossel · dicas bege",
        shortDescription: "Retrato elegante bege — dicas para redes.",
        previewPath: "/templates/carrossel-c01-dicas-bege.png",
        referenceFile: "carrossel-c01-dicas-bege.png",
        visionPrompt: CAROUSEL_SLIDE_VISION,
    },
    {
        id: "carrossel-c02-yellow-bw-microblog",
        title: "Carrossel · amarelo e preto",
        shortDescription: "Microblog moderno (amarelo, branco, preto).",
        previewPath: "/templates/carrossel-c02-yellow-bw-microblog.png",
        referenceFile: "carrossel-c02-yellow-bw-microblog.png",
        visionPrompt: CAROUSEL_SLIDE_VISION,
    },
    {
        id: "carrossel-c03-neutro-minimalista",
        title: "Carrossel · neutro minimalista",
        shortDescription: "Conteúdo social clean neutro.",
        previewPath: "/templates/carrossel-c03-neutro-minimalista.png",
        referenceFile: "carrossel-c03-neutro-minimalista.png",
        visionPrompt: CAROUSEL_SLIDE_VISION,
    },
    {
        id: "carrossel-c04-marketing-verde",
        title: "Carrossel · marketing verde",
        shortDescription: "Estratégias de marketing, verde moderno.",
        previewPath: "/templates/carrossel-c04-marketing-verde.png",
        referenceFile: "carrossel-c04-marketing-verde.png",
        visionPrompt: CAROUSEL_SLIDE_VISION,
    },
    {
        id: "carrossel-c05-teal-remote",
        title: "Carrossel · teal remoto",
        shortDescription: "How-to / trabalho remoto, teal.",
        previewPath: "/templates/carrossel-c05-teal-remote.png",
        referenceFile: "carrossel-c05-teal-remote.png",
        visionPrompt: CAROUSEL_SLIDE_VISION,
    },
    {
        id: "carrossel-c06-bege-branco",
        title: "Carrossel · bege e branco",
        shortDescription: "Retrato elegante bege e branco.",
        previewPath: "/templates/carrossel-c06-bege-branco.png",
        referenceFile: "carrossel-c06-bege-branco.png",
        visionPrompt: CAROUSEL_SLIDE_VISION,
    },
    {
        id: "carrossel-c07-consultoria",
        title: "Carrossel · consultoria",
        shortDescription: "Negócios — verde, azul e branco.",
        previewPath: "/templates/carrossel-c07-consultoria.png",
        referenceFile: "carrossel-c07-consultoria.png",
        visionPrompt: CAROUSEL_SLIDE_VISION,
    },
    {
        id: "carrossel-c08-amor-proprio-creme",
        title: "Carrossel · amor-próprio creme",
        shortDescription: "Minimalista creme.",
        previewPath: "/templates/carrossel-c08-amor-proprio-creme.png",
        referenceFile: "carrossel-c08-amor-proprio-creme.png",
        visionPrompt: CAROUSEL_SLIDE_VISION,
    },
    {
        id: "carrossel-c09-bw-gold-speaking",
        title: "Carrossel · ouro e palestra",
        shortDescription: "Preto, branco e dourado — speaking.",
        previewPath: "/templates/carrossel-c09-bw-gold-speaking.png",
        referenceFile: "carrossel-c09-bw-gold-speaking.png",
        visionPrompt: CAROUSEL_SLIDE_VISION,
    },
    {
        id: "carrossel-c10-marketing-branco-azul",
        title: "Carrossel · branco e azul",
        shortDescription: "Marketing digital branco e azul.",
        previewPath: "/templates/carrossel-c10-marketing-branco-azul.png",
        referenceFile: "carrossel-c10-marketing-branco-azul.png",
        visionPrompt: CAROUSEL_SLIDE_VISION,
    },
];

const POST_TEMPLATE_BY_ID = new Map(POST_TEMPLATES.map((t) => [t.id, t]));

export function getPostTemplateById(id: string): PostTemplate | undefined {
    return POST_TEMPLATE_BY_ID.get(id);
}

/** Convex / server: absolute URL to fetch template reference image */
export function getTemplateReferencePublicUrl(baseUrl: string, referenceFile: string): string {
    const base = baseUrl.replace(/\/$/, "");
    return `${base}/templates/${referenceFile}`;
}
