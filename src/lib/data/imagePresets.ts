export type ImagePresetKey =
	| "none"
	| "photorealistic"
	| "illustrative"
	| "minimalist"
	| "artistic";

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
    {
        key: "none",
        label: "Sem estilo",
        sublabel: "Só o que você descrever",
        prompt: "No global aesthetic preset. Follow the user's message as the main creative direction. Do not bias toward photorealism, illustration, minimalism, or bold art unless they ask. Keep output clear and professional.",
    },
];

export const DEFAULT_PRESET: ImagePresetKey = "photorealistic";

export function getPresetByKey(key: string): ImagePreset | undefined {
    return IMAGE_PRESETS.find((p) => p.key === key);
}

/** Prompt sent to the image API; omit for default photorealistic pipeline (no ## Image Style block). */
export function getStylePresetPromptForApi(selectedPresetKey: string): string | undefined {
    const preset = getPresetByKey(selectedPresetKey);
    if (!preset || preset.key === "photorealistic") return undefined;
    return preset.prompt;
}
