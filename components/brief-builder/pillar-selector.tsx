"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Tick01Icon, Add01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface ContentPillar {
    name: string;
    description: string;
}

interface PillarSelectorProps {
    pillars: ContentPillar[];
    selectedPillar: string | null;
    customTopic: string;
    onPillarChange: (pillar: string | null) => void;
    onCustomTopicChange: (topic: string) => void;
}

export function PillarSelector({
    pillars,
    selectedPillar,
    customTopic,
    onPillarChange,
    onCustomTopicChange,
}: PillarSelectorProps) {
    const [showCustom, setShowCustom] = useState(false);

    const handlePillarClick = (pillarName: string) => {
        if (selectedPillar === pillarName) {
            onPillarChange(null);
        } else {
            onPillarChange(pillarName);
            setShowCustom(false);
            onCustomTopicChange("");
        }
    };

    const handleCustomClick = () => {
        setShowCustom(true);
        onPillarChange(null);
    };

    return (
        <div className="space-y-3">
            <label className="text-sm font-medium">Pilar de Conteudo (opcional)</label>
            <p className="text-xs text-muted-foreground">
                Escolha um pilar da estrategia ou defina um topico personalizado
            </p>
            
            <div className="flex flex-wrap gap-2">
                {pillars.map((pillar) => {
                    const isSelected = selectedPillar === pillar.name;
                    return (
                        <button
                            key={pillar.name}
                            type="button"
                            onClick={() => handlePillarClick(pillar.name)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-none border text-sm transition-all",
                                isSelected
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                            )}
                            title={pillar.description}
                        >
                            {isSelected && (
                                <HugeiconsIcon icon={Tick01Icon} className="size-3.5" />
                            )}
                            {pillar.name}
                        </button>
                    );
                })}
                
                <button
                    type="button"
                    onClick={handleCustomClick}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-none border text-sm transition-all",
                        showCustom
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-dashed border-muted-foreground/50 hover:border-primary/50 hover:bg-muted/50 text-muted-foreground"
                    )}
                >
                    <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                    Personalizado
                </button>
            </div>

            {showCustom && (
                <div className="pt-2">
                    <Input
                        placeholder="Digite o topico do post..."
                        value={customTopic}
                        onChange={(e) => onCustomTopicChange(e.target.value)}
                        className="rounded-none"
                    />
                </div>
            )}
        </div>
    );
}
