export interface ChipOption {
    id: string;
    label: string;
}

export const AUDIENCE_OPTIONS: ChipOption[] = [
    { id: "jovens_18_25", label: "Jovens 18–25" },
    { id: "adultos_25_40", label: "Adultos 25–40" },
    { id: "adultos_40_plus", label: "Adultos 40+" },
    { id: "executivos", label: "Executivos" },
    { id: "maes", label: "Mães" },
    { id: "empreendedores", label: "Empreendedores" },
    { id: "estudantes", label: "Estudantes" },
    { id: "profissionais_criativos", label: "Profissionais criativos" },
    { id: "publico_geral", label: "Público geral" },
];

export const TONE_OPTIONS: ChipOption[] = [
    { id: "direto", label: "Direto" },
    { id: "provocativo", label: "Provocativo" },
    { id: "educacional", label: "Educacional" },
    { id: "premium", label: "Premium" },
    { id: "descontraido", label: "Descontraído" },
    { id: "inspirador", label: "Inspirador" },
    { id: "tecnico", label: "Técnico" },
    { id: "acolhedor", label: "Acolhedor" },
    { id: "bem_humorado", label: "Bem-humorado" },
    { id: "autoritario", label: "Autoritário" },
];
