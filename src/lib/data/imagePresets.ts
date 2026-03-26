export type ImagePresetKey = "photorealistic" | "illustrative" | "minimalist" | "artistic";

export interface ImagePreset {
    key: ImagePresetKey;
    label: string;
    sublabel: string;
    prompt: string;
}

export const IMAGE_PRESETS: ImagePreset[] = [
    {
        key: "photorealistic",
        label: "Fotorrealista",
        sublabel: "Foto profissional, câmera real",
        prompt: "PHOTOREALISTIC photograph taken with a professional DSLR camera. Must look like a real photo, NOT digital art, illustrations, or CGI renders. Sharp focus, natural lighting, realistic colors and textures. Professional quality suitable for Instagram.",
    },
    {
        key: "illustrative",
        label: "Ilustrativo",
        sublabel: "Ilustração digital, arte conceitual",
        prompt: "Digital illustration style. Clean vector-like or painted art with vibrant colors. Professional illustration suitable for social media. Can include stylized elements, flat design, or hand-drawn aesthetics.",
    },
    {
        key: "minimalist",
        label: "Minimalista",
        sublabel: "Clean, espaço em branco, simples",
        prompt: "Minimalist design with generous white/negative space. Clean composition, limited color palette, simple geometric shapes. Focus on essential elements only. Professional and modern aesthetic.",
    },
    {
        key: "artistic",
        label: "Artístico",
        sublabel: "Criativo, expressivo, ousado",
        prompt: "Artistic and expressive style. Bold colors, creative composition, dramatic lighting or abstract elements. Can blend photography with graphic design elements. Visually striking and memorable.",
    },
];

export const DEFAULT_PRESET: ImagePresetKey = "photorealistic";

export function getPresetByKey(key: string): ImagePreset | undefined {
    return IMAGE_PRESETS.find((p) => p.key === key);
}
