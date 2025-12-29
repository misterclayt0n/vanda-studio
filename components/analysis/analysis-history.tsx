"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
    Card,
    CardContent,
    CardTitle,
} from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Time01Icon,
    ArrowDown01Icon,
    ArrowUp01Icon,
    CheckmarkCircle02Icon,
    CancelCircleIcon,
    Clock01Icon,
    Loading01Icon,
    AnalyticsUpIcon,
} from "@hugeicons/core-free-icons";

interface AnalysisHistoryProps {
    projectId: Id<"projects">;
    onSelectAnalysis?: (analysisId: Id<"brand_analysis">) => void;
    currentAnalysisId?: Id<"brand_analysis">;
}

export function AnalysisHistory({
    projectId,
    onSelectAnalysis,
    currentAnalysisId,
}: AnalysisHistoryProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const analyses = useQuery(api.ai.analysisMutations.listAnalyses, {
        projectId,
    });

    if (!analyses || analyses.length <= 1) {
        return null;
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "completed":
                return <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-3.5 text-[var(--success)]" />;
            case "failed":
                return <HugeiconsIcon icon={CancelCircleIcon} strokeWidth={2} className="size-3.5 text-destructive" />;
            case "processing":
            case "pending":
                return <HugeiconsIcon icon={Loading01Icon} strokeWidth={2} className="size-3.5 text-primary animate-spin" />;
            default:
                return <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-3.5 text-muted-foreground" />;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case "completed":
                return "Concluida";
            case "failed":
                return "Falhou";
            case "processing":
                return "Processando";
            case "pending":
                return "Pendente";
            default:
                return status;
        }
    };

    return (
        <Card className="ring-1 ring-foreground/10">
            <div className="p-3">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center justify-between w-full text-left"
                >
                    <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={Time01Icon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
                        <CardTitle className="text-xs">Historico de Analises</CardTitle>
                        <span className="text-[10px] text-muted-foreground">
                            ({analyses.length} analises)
                        </span>
                    </div>
                    {isExpanded ? (
                        <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
                    ) : (
                        <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
                    )}
                </button>
            </div>

            {isExpanded && (
                <CardContent className="pt-0 pb-3">
                    <div className="space-y-1.5">
                        {analyses.map((analysis) => (
                            <button
                                key={analysis._id}
                                onClick={() => onSelectAnalysis?.(analysis._id)}
                                className={`w-full flex items-center justify-between p-2.5 rounded-none ring-1 transition-colors text-left ${
                                    currentAnalysisId === analysis._id
                                        ? "ring-primary bg-primary/5"
                                        : "ring-foreground/10 hover:ring-foreground/20 hover:bg-muted/50"
                                }`}
                            >
                                <div className="flex items-center gap-2.5">
                                    {getStatusIcon(analysis.status)}
                                    <div>
                                        <p className="text-xs font-medium">
                                            {new Date(analysis.createdAt).toLocaleDateString(
                                                "pt-BR",
                                                {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                }
                                            )}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {getStatusText(analysis.status)}
                                        </p>
                                    </div>
                                </div>

                                {analysis.status === "completed" && analysis.overallScore && (
                                    <div className="flex items-center gap-1 text-xs">
                                        <HugeiconsIcon icon={AnalyticsUpIcon} strokeWidth={2} className="size-3 text-primary" />
                                        <span className="font-medium text-primary">
                                            {analysis.overallScore}
                                        </span>
                                        <span className="text-muted-foreground">/100</span>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
