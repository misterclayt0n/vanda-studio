"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnalysisTrigger } from "./analysis-trigger";
import { BrandAnalysisCard } from "./brand-analysis-card";
import { PostDiffCard } from "./post-diff-card";
import { AnalysisHistory } from "./analysis-history";
import {
    Loader2,
    AlertTriangle,
    LayoutGrid,
    FileText,
    RefreshCw,
    Clock,
    Sparkles,
} from "lucide-react";

interface AnalysisSectionProps {
    projectId: Id<"projects">;
    posts: Doc<"instagram_posts">[];
}

type ViewMode = "brand" | "posts";

export function AnalysisSection({ projectId, posts }: AnalysisSectionProps) {
    const [viewMode, setViewMode] = useState<ViewMode>("brand");
    const [refreshKey, setRefreshKey] = useState(0);
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
                    <CardTitle>Análise de IA</CardTitle>
                    <CardDescription className="max-w-md mx-auto">
                        Obtenha insights detalhados sobre sua marca, sugestões de melhoria para cada post
                        e uma estratégia completa de conteúdo.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pb-8">
                    <AnalysisTrigger
                        projectId={projectId}
                        onAnalysisComplete={() => setRefreshKey((k) => k + 1)}
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
                            A IA está avaliando seu perfil e posts. Isso pode levar alguns segundos.
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
                        <p className="font-semibold">Análise falhou</p>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            {latestAnalysis.errorMessage || "Ocorreu um erro durante a análise. Tente novamente."}
                        </p>
                    </div>
                    <AnalysisTrigger
                        projectId={projectId}
                        onAnalysisComplete={() => setRefreshKey((k) => k + 1)}
                    />
                </CardContent>
            </Card>
        );
    }

    // Make sure we have a valid analysis to show
    if (!currentAnalysis || currentAnalysis.status !== "completed") {
        return null;
    }

    // Analysis completed - show results
    return (
        <div className="space-y-6">
            {/* Header with tabs and refresh */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Button
                        variant={viewMode === "brand" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewMode("brand")}
                    >
                        <FileText className="h-4 w-4" />
                        Estratégia
                    </Button>
                    <Button
                        variant={viewMode === "posts" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewMode("posts")}
                    >
                        <LayoutGrid className="h-4 w-4" />
                        Posts ({postAnalyses?.length || 0})
                    </Button>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                            Analisado em{" "}
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
                        onAnalysisComplete={() => {
                            setRefreshKey((k) => k + 1);
                            setSelectedAnalysisId(null); // Reset to latest after new analysis
                        }}
                    />
                </div>
            </div>

            {/* Content based on view mode */}
            {viewMode === "brand" ? (
                <BrandAnalysisCard analysis={currentAnalysis} />
            ) : (
                <div className="space-y-4">
                    {postAnalyses === undefined ? (
                        <Card>
                            <CardContent className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </CardContent>
                        </Card>
                    ) : postAnalyses.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                <LayoutGrid className="h-8 w-8 text-muted-foreground mb-4" />
                                <p className="text-muted-foreground">
                                    Nenhuma análise de post disponível.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {postAnalyses.map((postAnalysis) => {
                                const post = posts.find((p) => p._id === postAnalysis.postId);
                                if (!post) return null;

                                return (
                                    <PostDiffCard
                                        key={postAnalysis._id}
                                        post={post}
                                        analysis={postAnalysis}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Analysis History */}
            <AnalysisHistory
                projectId={projectId}
                onSelectAnalysis={(id) => setSelectedAnalysisId(id)}
                currentAnalysisId={currentAnalysis._id}
            />
        </div>
    );
}
