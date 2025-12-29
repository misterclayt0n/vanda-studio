"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Tick01Icon,
    Loading03Icon,
    RefreshIcon,
    Idea01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CreativeAngle {
    id: string;
    hook: string;
    approach: string;
    whyItWorks: string;
    exampleOpener: string;
}

interface CreativeAnglesDisplayProps {
    angles: CreativeAngle[] | null;
    selectedAngle: CreativeAngle | null;
    isLoading: boolean;
    onSelectAngle: (angle: CreativeAngle) => void;
    onRefresh: () => void;
    cached?: boolean;
}

export function CreativeAnglesDisplay({
    angles,
    selectedAngle,
    isLoading,
    onSelectAngle,
    onRefresh,
    cached,
}: CreativeAnglesDisplayProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    if (isLoading) {
        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Angulos Criativos</label>
                </div>
                <div className="flex flex-col items-center justify-center py-12 border rounded-none bg-muted/30">
                    <HugeiconsIcon
                        icon={Loading03Icon}
                        className="size-8 animate-spin text-primary mb-3"
                    />
                    <p className="text-sm text-muted-foreground">
                        Gerando angulos criativos...
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Isso pode levar alguns segundos
                    </p>
                </div>
            </div>
        );
    }

    if (!angles || angles.length === 0) {
        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Angulos Criativos</label>
                </div>
                <div className="flex flex-col items-center justify-center py-12 border rounded-none bg-muted/30 border-dashed">
                    <HugeiconsIcon
                        icon={Idea01Icon}
                        className="size-8 text-muted-foreground/50 mb-3"
                    />
                    <p className="text-sm text-muted-foreground">
                        Preencha o brief acima para gerar angulos
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Angulos Criativos</label>
                    {cached && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-none bg-muted text-muted-foreground">
                            cache
                        </span>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRefresh}
                    className="gap-1.5 h-7 text-xs"
                >
                    <HugeiconsIcon icon={RefreshIcon} className="size-3.5" />
                    Novos angulos
                </Button>
            </div>

            <div className="space-y-3">
                {angles.map((angle) => {
                    const isSelected = selectedAngle?.id === angle.id;
                    const isExpanded = expandedId === angle.id;

                    return (
                        <div
                            key={angle.id}
                            className={cn(
                                "rounded-none border transition-all cursor-pointer",
                                isSelected
                                    ? "border-primary ring-1 ring-primary bg-primary/5"
                                    : "border-border hover:border-primary/50"
                            )}
                            onClick={() => onSelectAngle(angle)}
                        >
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            {isSelected && (
                                                <HugeiconsIcon
                                                    icon={Tick01Icon}
                                                    className="size-4 text-primary flex-shrink-0"
                                                />
                                            )}
                                            <p className="text-sm font-medium truncate">
                                                {angle.hook}
                                            </p>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                            {angle.approach}
                                        </p>
                                    </div>
                                </div>

                                {/* Expandable details */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedId(isExpanded ? null : angle.id);
                                    }}
                                    className="text-xs text-primary hover:underline mt-2"
                                >
                                    {isExpanded ? "Menos detalhes" : "Ver detalhes"}
                                </button>

                                {isExpanded && (
                                    <div className="mt-3 pt-3 border-t space-y-2">
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                                Por que funciona
                                            </p>
                                            <p className="text-xs">{angle.whyItWorks}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                                Exemplo de abertura
                                            </p>
                                            <p className="text-xs italic text-muted-foreground">
                                                &quot;{angle.exampleOpener}&quot;
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
