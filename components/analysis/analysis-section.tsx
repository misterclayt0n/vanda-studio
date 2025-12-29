"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisTrigger } from "./analysis-trigger";
import { BrandAnalysisCard } from "./brand-analysis-card";
import { AnalysisHistory } from "./analysis-history";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Loading01Icon,
    Alert01Icon,
    Clock01Icon,
    AiMagicIcon,
    FileAttachmentIcon,
} from "@hugeicons/core-free-icons";

interface AnalysisSectionProps {
    projectId: Id<"projects">;
}

export function AnalysisSection({ projectId }: AnalysisSectionProps) {
    const [selectedAnalysisId, setSelectedAnalysisId] = useState<Id<"brand_analysis"> | null>(null);

    const latestAnalysis = useQuery(
        api.ai.analysisMutations.getLatestAnalysis,
        { projectId }
    );

    // Get the current analysis to display (either selected or latest)
    const allAnalyses = useQuery(api.ai.analysisMutations.listAnalyses, { projectId });
    const currentAnalysis = selectedAnalysisId
        ? allAnalyses?.find((a) => a._id === selectedAnalysisId) ?? latestAnalysis
        : latestAnalysis;

    // Loading state
    if (latestAnalysis === undefined) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12">
                    <HugeiconsIcon icon={Loading01Icon} strokeWidth={2} className="size-5 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    // No analysis yet
    if (latestAnalysis === null) {
        return (
            <Card className="ring-1 ring-primary/20">
                <CardHeader className="text-center">
                    <div className="mx-auto h-12 w-12 rounded-none bg-primary/10 flex items-center justify-center mb-3">
                        <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} className="size-6 text-primary" />
                    </div>
                    <CardTitle className="text-sm">Analise de IA</CardTitle>
                    <CardDescription className="max-w-md mx-auto text-xs">
                        Obtenha insights detalhados sobre sua marca, sugestoes de melhoria para cada post
                        e uma estrategia completa de conteudo.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pb-6">
                    <AnalysisTrigger
                        projectId={projectId}
                        onAnalysisComplete={() => {}}
                    />
                </CardContent>
            </Card>
        );
    }

    // Analysis in progress (only show for latest, not selected)
    if (!selectedAnalysisId && (latestAnalysis.status === "pending" || latestAnalysis.status === "processing")) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="relative h-12 w-12">
                        <div className="absolute inset-0 rounded-none ring-1 ring-primary/20" />
                        <div className="absolute inset-1 rounded-none ring-1 ring-primary/30 animate-pulse" />
                        <div className="absolute inset-2 rounded-none ring-2 ring-primary/60 animate-spin ring-t-transparent" />
                    </div>
                    <div className="text-center space-y-1">
                        <p className="text-sm font-medium">Analisando sua marca...</p>
                        <p className="text-xs text-muted-foreground">
                            A IA esta avaliando seu perfil e posts. Isso pode levar alguns segundos.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Analysis failed (only show for latest, not selected)
    if (!selectedAnalysisId && latestAnalysis.status === "failed") {
        return (
            <Card className="ring-1 ring-destructive/50">
                <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="h-10 w-10 rounded-none bg-destructive/10 flex items-center justify-center">
                        <HugeiconsIcon icon={Alert01Icon} strokeWidth={2} className="size-5 text-destructive" />
                    </div>
                    <div className="text-center space-y-1">
                        <p className="text-sm font-medium">Analise falhou</p>
                        <p className="text-xs text-muted-foreground max-w-sm">
                            {latestAnalysis.errorMessage || "Ocorreu um erro durante a analise. Tente novamente."}
                        </p>
                    </div>
                    <AnalysisTrigger
                        projectId={projectId}
                        onAnalysisComplete={() => {}}
                    />
                </CardContent>
            </Card>
        );
    }

    // Make sure we have a valid analysis to show
    if (!currentAnalysis || currentAnalysis.status !== "completed") {
        return null;
    }

    // Analysis completed - show brand strategy
    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-none bg-primary/10 flex items-center justify-center shrink-0">
                            <HugeiconsIcon icon={FileAttachmentIcon} strokeWidth={2} className="size-4 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-sm">Estrategia de Marca</CardTitle>
                            <CardDescription className="text-xs">Analise completa e recomendacoes</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-auto">
                        <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-3" />
                            <span>
                                {new Date(currentAnalysis.createdAt).toLocaleDateString("pt-BR", {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </span>
                        </div>
                        <AnalysisTrigger
                            projectId={projectId}
                            onAnalysisComplete={() => setSelectedAnalysisId(null)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <BrandAnalysisCard analysis={currentAnalysis} />
                </CardContent>
            </Card>

            {/* Analysis History */}
            <AnalysisHistory
                projectId={projectId}
                onSelectAnalysis={(id) => setSelectedAnalysisId(id)}
                currentAnalysisId={currentAnalysis._id}
            />
        </div>
    );
}
