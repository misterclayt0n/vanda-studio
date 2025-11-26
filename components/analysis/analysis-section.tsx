"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisTrigger } from "./analysis-trigger";
import { BrandAnalysisCard } from "./brand-analysis-card";
import { PostDiffViewer } from "./post-diff-viewer";
import { AnalysisHistory } from "./analysis-history";
import {
    Loader2,
    AlertTriangle,
    Clock,
    Sparkles,
    FileText,
    Wand2,
} from "lucide-react";

// Post with storage URLs from listByProject query
type PostWithStorageUrls = Doc<"instagram_posts"> & {
    mediaStorageUrl: string | null;
    thumbnailStorageUrl: string | null;
    carouselImagesWithUrls?: {
        url: string;
        storageId?: Id<"_storage">;
        storageUrl?: string | null;
    }[];
};

interface AnalysisSectionProps {
    projectId: Id<"projects">;
    posts: PostWithStorageUrls[];
    view: "strategy" | "suggestions";
}

export function AnalysisSection({ projectId, posts, view }: AnalysisSectionProps) {
    const [selectedAnalysisId, setSelectedAnalysisId] = useState<Id<"brand_analysis"> | null>(null);

    const latestAnalysis = useQuery(
        api.ai.analysisMutations.getLatestAnalysis,
        { projectId }
    );

    // Use selected analysis or fallback to latest
    const currentAnalysisId = selectedAnalysisId || latestAnalysis?._id;

    const postAnalyses = useQuery(
        api.ai.analysisMutations.getPostAnalyses,
        currentAnalysisId ? { analysisId: currentAnalysisId } : "skip"
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
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    // No analysis yet
    if (latestAnalysis === null) {
        return (
            <Card className="border-dashed border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader className="text-center">
                    <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-purple flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
                        <Sparkles className="h-8 w-8 text-white" />
                    </div>
                    <CardTitle>Analise de IA</CardTitle>
                    <CardDescription className="max-w-md mx-auto">
                        Obtenha insights detalhados sobre sua marca, sugestoes de melhoria para cada post
                        e uma estrategia completa de conteudo.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pb-8">
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
                <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                    <div className="relative h-20 w-20">
                        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                        <div className="absolute inset-2 rounded-full border-4 border-primary/30 animate-pulse" />
                        <div className="absolute inset-4 rounded-full border-4 border-primary/60 animate-spin border-t-transparent" />
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-lg font-semibold">Analisando sua marca...</p>
                        <p className="text-sm text-muted-foreground">
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
            <Card className="border-destructive/50">
                <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                        <AlertTriangle className="h-6 w-6 text-destructive" />
                    </div>
                    <div className="text-center space-y-2">
                        <p className="font-semibold">Analise falhou</p>
                        <p className="text-sm text-muted-foreground max-w-sm">
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

    // Analysis completed - render based on view prop
    if (view === "strategy") {
        return (
            <div className="space-y-6">
                <Card>
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle>Estrategia de Marca</CardTitle>
                                <CardDescription>Analise completa e recomendacoes</CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 self-end sm:self-auto">
                            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
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

    // view === "suggestions"
    return (
        <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                        <Wand2 className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                        <CardTitle>Sugestoes de Posts</CardTitle>
                        <CardDescription>
                            Clique em um post para ver a analise ({postAnalyses?.length || 0} posts)
                        </CardDescription>
                    </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground self-end sm:self-auto">
                    <Clock className="h-3 w-3" />
                    <span>
                        {new Date(currentAnalysis.createdAt).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </span>
                </div>
            </CardHeader>
            <CardContent>
                {postAnalyses === undefined ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <PostDiffViewer posts={posts} analyses={postAnalyses} />
                )}
            </CardContent>
        </Card>
    );
}
