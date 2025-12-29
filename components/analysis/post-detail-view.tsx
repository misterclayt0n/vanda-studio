"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    ArrowLeft01Icon,
    Loading03Icon,
    SparklesIcon,
    AnalyticsUpIcon,
    CheckmarkCircle02Icon,
    AlertCircleIcon,
    ChartIncreaseIcon,
    HashtagIcon,
    Message01Icon,
    Image01Icon,
    Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { usePostTabs } from "@/components/sidebar/post-tabs-context";

// Post with storage URLs
type PostWithStorageUrls = Doc<"instagram_posts"> & {
    mediaStorageUrl: string | null;
    thumbnailStorageUrl: string | null;
    carouselImagesWithUrls?: {
        url: string;
        storageId?: Id<"_storage">;
        storageUrl?: string | null;
    }[];
};

interface PostDetailViewProps {
    post: PostWithStorageUrls;
    projectId: Id<"projects">;
    onBack: () => void;
}

export function PostDetailView({ post, projectId, onBack }: PostDetailViewProps) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { closePost } = usePostTabs();

    const analyzePost = useAction(api.ai.postAnalysis.analyzePost);

    // Get existing analysis for this post
    const analysis = useQuery(api.ai.analysisMutations.getPostAnalysis, {
        postId: post._id,
    });

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        setError(null);
        try {
            await analyzePost({ projectId, postId: post._id });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao analisar post");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleClose = () => {
        closePost(post._id);
        onBack();
    };

    const score = analysis?.score ?? 0;
    const scoreColor =
        score >= 80
            ? "text-green-500 bg-green-500/10 border-green-500/30"
            : score >= 60
              ? "text-yellow-500 bg-yellow-500/10 border-yellow-500/30"
              : "text-red-500 bg-red-500/10 border-red-500/30";

    return (
        <div className="space-y-6">
            {/* Header with back button */}
            <div className="flex items-center justify-between">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="gap-2"
                >
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                    Voltar aos Posts
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClose}
                    className="h-8 w-8"
                    title="Fechar post"
                >
                    <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                </Button>
            </div>

            {/* Error display */}
            {error && (
                <div className="rounded-none border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-3">
                    <HugeiconsIcon icon={AlertCircleIcon} className="size-5 shrink-0" />
                    {error}
                </div>
            )}

            {/* Main content grid */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Left column - Post preview and actions */}
                <div className="space-y-4">
                    {/* Post image */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="aspect-square rounded-none overflow-hidden bg-muted">
                                <PostImage post={post} />
                            </div>

                            {/* Post metadata */}
                            <div className="mt-4 space-y-3">
                                <p className="text-sm line-clamp-4 text-muted-foreground">
                                    {post.caption || "Sem legenda"}
                                </p>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>
                                        {post.likeCount !== undefined && post.likeCount >= 0
                                            ? `${post.likeCount} curtidas`
                                            : ""}
                                    </span>
                                    <span>{new Date(post.timestamp).toLocaleDateString("pt-BR")}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Action button */}
                    <Button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        className="w-full gap-2"
                    >
                        {isAnalyzing ? (
                            <>
                                <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
                                Analisando...
                            </>
                        ) : (
                            <>
                                <HugeiconsIcon icon={AnalyticsUpIcon} className="size-4" />
                                {analysis?.hasAnalysis ? "Reanalisar" : "Analisar para Contexto"}
                            </>
                        )}
                    </Button>

                    {/* Credit notice */}
                    <p className="text-xs text-muted-foreground text-center">
                        Analise consome 1 prompt do seu plano
                    </p>
                </div>

                {/* Right column - Analysis results */}
                <div className="space-y-4">
                    {analysis === undefined ? (
                        <Card>
                            <CardContent className="flex items-center justify-center py-16">
                                <HugeiconsIcon icon={Loading03Icon} className="size-6 animate-spin text-muted-foreground" />
                            </CardContent>
                        </Card>
                    ) : analysis === null || !analysis.hasAnalysis ? (
                        <Card className="border-dashed border-2">
                            <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                                <div className="h-16 w-16 rounded-none bg-primary/10 flex items-center justify-center opacity-50">
                                    <HugeiconsIcon icon={SparklesIcon} className="size-8 text-primary" />
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="font-semibold text-muted-foreground">
                                        Nenhuma analise ainda
                                    </p>
                                    <p className="text-sm text-muted-foreground max-w-sm">
                                        Clique em &quot;Analisar para Contexto&quot; para entender o que funciona neste post e usar como referencia para gerar novos posts.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <HugeiconsIcon icon={AnalyticsUpIcon} className="size-4" />
                                        Analise do Post
                                    </CardTitle>
                                    {analysis.score !== undefined && (
                                        <div
                                            className={cn(
                                                "px-4 py-2 rounded-none text-2xl font-bold border",
                                                scoreColor
                                            )}
                                        >
                                            {analysis.score}/100
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {analysis.analysisDetails && (
                                    <>
                                        {/* Strengths */}
                                        {analysis.analysisDetails.strengths.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                    Pontos Fortes
                                                </p>
                                                <div className="space-y-1.5">
                                                    {analysis.analysisDetails.strengths.map((str, idx) => (
                                                        <div key={idx} className="flex items-start gap-2 text-sm">
                                                            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 text-green-500 mt-0.5 shrink-0" />
                                                            <span>{str}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Insights for context */}
                                        {analysis.analysisDetails.weaknesses.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                    Observacoes
                                                </p>
                                                <div className="space-y-1.5">
                                                    {analysis.analysisDetails.weaknesses.map((obs, idx) => (
                                                        <div key={idx} className="flex items-start gap-2 text-sm">
                                                            <HugeiconsIcon icon={AlertCircleIcon} className="size-4 text-yellow-500 mt-0.5 shrink-0" />
                                                            <span>{obs}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Other insights */}
                                        <div className="grid gap-3 sm:grid-cols-3">
                                            <InsightCard
                                                icon={ChartIncreaseIcon}
                                                label="Engajamento"
                                                value={analysis.analysisDetails.engagementPrediction}
                                            />
                                            <InsightCard
                                                icon={HashtagIcon}
                                                label="Hashtags"
                                                value={analysis.analysisDetails.hashtagAnalysis}
                                            />
                                            <InsightCard
                                                icon={Message01Icon}
                                                label="Tom"
                                                value={analysis.analysisDetails.toneAnalysis}
                                            />
                                        </div>
                                    </>
                                )}

                                {/* AI Reasoning */}
                                {analysis.reasoning && (
                                    <div className="rounded-none border bg-muted/30 p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="h-8 w-8 rounded-none bg-primary/10 flex items-center justify-center shrink-0">
                                                <HugeiconsIcon icon={SparklesIcon} className="size-4 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">
                                                    Resumo da Analise
                                                </p>
                                                <p className="text-sm text-muted-foreground leading-relaxed">
                                                    {analysis.reasoning}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Context confirmation */}
                                <div className="rounded-none border border-green-500/30 bg-green-500/10 p-4">
                                    <div className="flex items-center gap-3">
                                        <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5 text-green-500 shrink-0" />
                                        <p className="text-sm text-green-700 dark:text-green-300">
                                            Este post esta contribuindo para o contexto de geracao
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}

function PostImage({ post }: { post: PostWithStorageUrls }) {
    const [currentUrlIndex, setCurrentUrlIndex] = useState(0);

    const urls = [
        post.mediaStorageUrl,
        post.thumbnailStorageUrl,
        post.mediaUrl,
        post.thumbnailUrl,
    ].filter((url): url is string => Boolean(url));

    const currentUrl = urls[currentUrlIndex];

    if (!currentUrl || currentUrlIndex >= urls.length) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <HugeiconsIcon icon={Image01Icon} className="size-8" />
                <span className="text-xs">Imagem indisponivel</span>
            </div>
        );
    }

    return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
            src={currentUrl}
            alt="Post original"
            className="h-full w-full object-cover"
            onError={() => setCurrentUrlIndex((prev) => prev + 1)}
        />
    );
}

interface InsightCardProps {
    icon: typeof ChartIncreaseIcon;
    label: string;
    value: string;
}

function InsightCard({ icon, label, value }: InsightCardProps) {
    return (
        <div className="rounded-none border bg-muted/30 p-3 space-y-1">
            <div className="flex items-center gap-1.5">
                <HugeiconsIcon icon={icon} className="size-3.5 text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {label}
                </span>
            </div>
            <p className="text-sm font-medium line-clamp-2">{value}</p>
        </div>
    );
}
