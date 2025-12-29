"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Tick01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

interface ToneSelectorProps {
    availableTones: string[];
    selectedTones: string[];
    onChange: (tones: string[]) => void;
}

// Common tones for Instagram posts
const COMMON_TONES = [
    "profissional",
    "descontraido",
    "inspirador",
    "educativo",
    "divertido",
    "emocional",
    "urgente",
    "sofisticado",
    "acessivel",
    "provocativo",
];

export function ToneSelector({
    availableTones,
    selectedTones,
    onChange,
}: ToneSelectorProps) {
    // Combine available tones from brand with common tones
    const allTones = [...new Set([...availableTones, ...COMMON_TONES])];

    const toggleTone = (tone: string) => {
        if (selectedTones.includes(tone)) {
            onChange(selectedTones.filter((t) => t !== tone));
        } else {
            // Max 3 tones
            if (selectedTones.length < 3) {
                onChange([...selectedTones, tone]);
            }
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Tom da Legenda (opcional)</label>
                <span className="text-xs text-muted-foreground">
                    {selectedTones.length}/3
                </span>
            </div>
            <p className="text-xs text-muted-foreground">
                Sobrescreva o tom padrao da marca se necessario
            </p>

            <div className="flex flex-wrap gap-2">
                {allTones.map((tone) => {
                    const isSelected = selectedTones.includes(tone);
                    const isFromBrand = availableTones.includes(tone);
                    return (
                        <button
                            key={tone}
                            type="button"
                            onClick={() => toggleTone(tone)}
                            disabled={!isSelected && selectedTones.length >= 3}
                            className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-none border text-xs transition-all capitalize",
                                isSelected
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border hover:border-primary/50 hover:bg-muted/50",
                                !isSelected && selectedTones.length >= 3 && "opacity-50 cursor-not-allowed",
                                isFromBrand && !isSelected && "border-primary/30"
                            )}
                            title={isFromBrand ? "Tom recomendado pela analise de marca" : undefined}
                        >
                            {isSelected && (
                                <HugeiconsIcon icon={Tick01Icon} className="size-3" />
                            )}
                            {tone}
                            {isFromBrand && !isSelected && (
                                <span className="ml-1 text-[10px] text-primary/70">*</span>
                            )}
                        </button>
                    );
                })}
            </div>
            
            {availableTones.length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                    * Tons recomendados pela analise de marca
                </p>
            )}
        </div>
    );
}
