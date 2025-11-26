"use client";

import { useMemo } from "react";
import { diffWords } from "diff";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";

interface CaptionDiffProps {
    original: string;
    suggested: string;
    className?: string;
}

export function CaptionDiff({ original, suggested, className }: CaptionDiffProps) {
    const diff = useMemo(() => {
        return diffWords(original, suggested);
    }, [original, suggested]);

    // Calculate stats
    const stats = useMemo(() => {
        let added = 0;
        let removed = 0;

        diff.forEach((part) => {
            if (part.added) {
                added += part.value.length;
            } else if (part.removed) {
                removed += part.value.length;
            }
        });

        return { added, removed };
    }, [diff]);

    return (
        <div className={cn("space-y-4", className)}>
            {/* Stats bar */}
            <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 text-red-500">
                    <Minus className="h-3 w-3" />
                    <span>{stats.removed} removidos</span>
                </div>
                <div className="flex items-center gap-1.5 text-green-500">
                    <Plus className="h-3 w-3" />
                    <span>{stats.added} adicionados</span>
                </div>
            </div>

            {/* Split view */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Original */}
                <div className="rounded-xl border border-red-500/20 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border-b border-red-500/20">
                        <Minus className="h-3.5 w-3.5 text-red-500" />
                        <span className="text-xs font-semibold text-red-500 uppercase tracking-wide">
                            Original
                        </span>
                    </div>
                    <div className="p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono bg-red-500/5">
                        {diff.map((part, index) => {
                            if (part.added) {
                                return null; // Don't show added parts in original
                            }
                            return (
                                <span
                                    key={index}
                                    className={cn(
                                        part.removed && "bg-red-500/30 text-red-700 dark:text-red-300 line-through decoration-red-500/50"
                                    )}
                                >
                                    {part.value}
                                </span>
                            );
                        })}
                    </div>
                </div>

                {/* Suggested */}
                <div className="rounded-xl border border-green-500/20 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border-b border-green-500/20">
                        <Plus className="h-3.5 w-3.5 text-green-500" />
                        <span className="text-xs font-semibold text-green-500 uppercase tracking-wide">
                            Sugerida
                        </span>
                    </div>
                    <div className="p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono bg-green-500/5">
                        {diff.map((part, index) => {
                            if (part.removed) {
                                return null; // Don't show removed parts in suggested
                            }
                            return (
                                <span
                                    key={index}
                                    className={cn(
                                        part.added && "bg-green-500/30 text-green-700 dark:text-green-300"
                                    )}
                                >
                                    {part.value}
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Unified diff view (mobile-friendly alternative) */}
            <details className="md:hidden">
                <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    Ver comparacao unificada
                </summary>
                <div className="mt-2 rounded-xl border overflow-hidden">
                    <div className="p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono bg-muted/30">
                        {diff.map((part, index) => (
                            <span
                                key={index}
                                className={cn(
                                    part.added && "bg-green-500/30 text-green-700 dark:text-green-300",
                                    part.removed && "bg-red-500/30 text-red-700 dark:text-red-300 line-through decoration-red-500/50"
                                )}
                            >
                                {part.value}
                            </span>
                        ))}
                    </div>
                </div>
            </details>
        </div>
    );
}

// Alternative inline diff view for smaller spaces
export function InlineCaptionDiff({ original, suggested, className }: CaptionDiffProps) {
    const diff = useMemo(() => {
        return diffWords(original, suggested);
    }, [original, suggested]);

    return (
        <div className={cn("text-sm leading-relaxed whitespace-pre-wrap font-mono", className)}>
            {diff.map((part, index) => (
                <span
                    key={index}
                    className={cn(
                        part.added && "bg-green-500/30 text-green-700 dark:text-green-300 rounded px-0.5",
                        part.removed && "bg-red-500/30 text-red-700 dark:text-red-300 line-through decoration-red-500/50 rounded px-0.5"
                    )}
                >
                    {part.value}
                </span>
            ))}
        </div>
    );
}
