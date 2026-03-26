export type VibeKey = "minimalista" | "luxo" | "tech" | "criativo" | "ousado" | "natural";

export interface BrandVibe {
    key: VibeKey;
    label: string;
    sublabel: string;
    /** Example colors shown on the card UI -- NOT applied to the brand kit. */
    swatchColors: string[];
    /** Injected as `extraHint` into `suggestBrandSection("visual")` when this vibe is selected. */
    prompt: string;
}

export const BRAND_VIBES: BrandVibe[] = [
    {
        key: "minimalista",
        label: "Minimalista",
        sublabel: "Clean, espaço, menos é mais",
        swatchColors: ["#1a1a1a", "#f5f5f5", "#e0e0e0", "#ffffff"],
        prompt: "Estilo minimalista: tons neutros (preto, branco, cinza claro), tipografia clean sans-serif, muito espaço em branco, composições simples e equilibradas.",
    },
    {
        key: "luxo",
        label: "Luxo",
        sublabel: "Sofisticado, premium, elegante",
        swatchColors: ["#0d0d0d", "#c9a94e", "#2c2c2c", "#f4eed7"],
        prompt: "Estilo luxo/premium: tons escuros com acentos dourados ou metálicos, tipografia serifada elegante, fotografia de alto contraste, texturas ricas.",
    },
    {
        key: "tech",
        label: "Tech",
        sublabel: "Moderno, digital, inovador",
        swatchColors: ["#0f172a", "#3b82f6", "#1e293b", "#e2e8f0"],
        prompt: "Estilo tech/moderno: tons escuros com azul elétrico ou ciano, tipografia geométrica/grotesca, visual futurista, gradientes sutis, ícones lineares.",
    },
    {
        key: "criativo",
        label: "Criativo",
        sublabel: "Colorido, expressivo, artístico",
        swatchColors: ["#6d28d9", "#f43f5e", "#facc15", "#10b981"],
        prompt: "Estilo criativo/artístico: paleta multicolorida e vibrante, tipografia expressiva/display, composições dinâmicas, colagens, sobreposições.",
    },
    {
        key: "ousado",
        label: "Ousado",
        sublabel: "Intenso, marcante, disruptivo",
        swatchColors: ["#000000", "#ff2d55", "#ff6b00", "#ffffff"],
        prompt: "Estilo ousado/disruptivo: alto contraste preto com vermelho ou laranja intenso, tipografia bold/black impactante, ângulos fortes, elementos gráficos geométricos.",
    },
    {
        key: "natural",
        label: "Natural",
        sublabel: "Orgânico, acolhedor, terroso",
        swatchColors: ["#5c4033", "#a8c686", "#f5f0e8", "#d4a574"],
        prompt: "Estilo natural/orgânico: tons terrosos (marrom, verde musgo, bege), tipografia serifada clássica, fotografia com luz suave, texturas naturais, elementos botânicos.",
    },
];

export function getVibeByKey(key: VibeKey): BrandVibe | undefined {
    return BRAND_VIBES.find((v) => v.key === key);
}
