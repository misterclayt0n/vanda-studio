"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    History,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    XCircle,
    Clock,
    Loader2,
    TrendingUp,
} from "lucide-react";

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
                return <CheckCircle2 className="h-4 w-4 text-green-500" />;
            case "failed":
                return <XCircle className="h-4 w-4 text-red-500" />;
            case "processing":
            case "pending":
                return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
            default:
                return <Clock className="h-4 w-4 text-muted-foreground" />;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case "completed":
                return "Concluída";
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
        <Card className="border-dashed">
            <CardHeader className="pb-3">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center justify-between w-full text-left"
                >
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base">Histórico de Análises</CardTitle>
                        <span className="text-xs text-muted-foreground">
                            ({analyses.length} análises)
                        </span>
                    </div>
                    {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                </button>
            </CardHeader>

            {isExpanded && (
                <CardContent className="pt-0">
                    <div className="space-y-2">
                        {analyses.map((analysis) => (
                            <button
                                key={analysis._id}
                                onClick={() => onSelectAnalysis?.(analysis._id)}
                                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                                    currentAnalysisId === analysis._id
                                        ? "border-primary bg-primary/5"
                                        : "border-border/50 hover:border-primary/30 hover:bg-muted/50"
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    {getStatusIcon(analysis.status)}
                                    <div>
                                        <p className="text-sm font-medium">
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
                                        <p className="text-xs text-muted-foreground">
                                            {getStatusText(analysis.status)}
                                        </p>
                                    </div>
                                </div>

                                {analysis.status === "completed" && analysis.overallScore && (
                                    <div className="flex items-center gap-1 text-sm">
                                        <TrendingUp className="h-3 w-3 text-primary" />
                                        <span className="font-bold text-primary">
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
