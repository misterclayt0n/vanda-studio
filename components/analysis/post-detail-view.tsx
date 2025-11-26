"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CaptionDiff } from "./caption-diff";
import {
    ArrowLeft,
    Loader2,
    Sparkles,
    Wand2,
    BarChart3,
    CheckCircle2,
    AlertCircle,
    TrendingUp,
    Hash,
    MessageSquare,
    Copy,
    Check,
    ImageIcon,
    X,
} from "lucide-react";
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
    const [isReimagining, setIsReimagining] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { closePost } = usePostTabs();

    const analyzePost = useAction(api.ai.postAnalysis.analyzePost);
    const reimaginePost = useAction(api.ai.postAnalysis.reimaginePost);

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

    const handleReimagine = async () => {
        setIsReimagining(true);
        setError(null);
        try {
            await reimaginePost({ projectId, postId: post._id });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao reimaginar post");
        } finally {
            setIsReimagining(false);
        }
    };

    const handleCopy = async () => {
        if (analysis?.suggestedCaption) {
            await navigator.clipboard.writeText(analysis.suggestedCaption);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
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
                    <ArrowLeft className="h-4 w-4" />
                    Voltar aos Posts
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClose}
                    className="h-8 w-8"
                    title="Fechar post"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Error display */}
            {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 shrink-0" />
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
                            <div className="aspect-square rounded-xl overflow-hidden bg-muted">
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

                    {/* Action buttons */}
                    <div className="flex gap-3">
                        <Button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || isReimagining}
                            className="flex-1 gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                        >
                            {isAnalyzing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Analisando...
                                </>
                            ) : (
                                <>
                                    <BarChart3 className="h-4 w-4" />
                                    Analisar
                                </>
                            )}
                        </Button>
                        <Button
                            onClick={handleReimagine}
                            disabled={isAnalyzing || isReimagining}
                            variant="outline"
                            className="flex-1 gap-2 border-green-500/30 text-green-500 hover:bg-green-500/10 hover:text-green-500"
                        >
                            {isReimagining ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Reimaginando...
                                </>
                            ) : (
                                <>
                                    <Wand2 className="h-4 w-4" />
                                    Reimaginar
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Credit notice */}
                    <p className="text-xs text-muted-foreground text-center">
                        Cada acao consome 1 prompt do seu plano
                    </p>
                </div>

                {/* Right column - Analysis results */}
                <div className="space-y-4">
                    {analysis === undefined ? (
                        <Card>
                            <CardContent className="flex items-center justify-center py-16">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </CardContent>
                        </Card>
                    ) : analysis === null ? (
                        <Card className="border-dashed border-2">
                            <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                                <div className="h-16 w-16 rounded-2xl bg-gradient-pink flex items-center justify-center opacity-50">
                                    <Sparkles className="h-8 w-8 text-white" />
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="font-semibold text-muted-foreground">
                                        Nenhuma analise ainda
                                    </p>
                                    <p className="text-sm text-muted-foreground max-w-sm">
                                        Clique em &quot;Analisar&quot; para obter uma avaliacao detalhada ou &quot;Reimaginar&quot; para sugestoes de legenda.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            {/* Analysis Score */}
                            {analysis.hasAnalysis && analysis.score !== undefined && (
                                <Card>
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <BarChart3 className="h-4 w-4" />
                                                Pontuacao do Post
                                            </CardTitle>
                                            <div
                                                className={cn(
                                                    "px-4 py-2 rounded-xl text-2xl font-bold border",
                                                    scoreColor
                                                )}
                                            >
                                                {analysis.score}/100
                                            </div>
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
                                                                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                                                    <span>{str}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Weaknesses */}
                                                {analysis.analysisDetails.weaknesses.length > 0 && (
                                                    <div className="space-y-2">
                                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                            Pontos de Melhoria
                                                        </p>
                                                        <div className="space-y-1.5">
                                                            {analysis.analysisDetails.weaknesses.map((weak, idx) => (
                                                                <div key={idx} className="flex items-start gap-2 text-sm">
                                                                    <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                                                                    <span>{weak}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Other insights */}
                                                <div className="grid gap-3 sm:grid-cols-3">
                                                    <InsightCard
                                                        icon={TrendingUp}
                                                        label="Engajamento"
                                                        value={analysis.analysisDetails.engagementPrediction}
                                                    />
                                                    <InsightCard
                                                        icon={Hash}
                                                        label="Hashtags"
                                                        value={analysis.analysisDetails.hashtagAnalysis}
                                                    />
                                                    <InsightCard
                                                        icon={MessageSquare}
                                                        label="Tom"
                                                        value={analysis.analysisDetails.toneAnalysis}
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {/* AI Reasoning */}
                                        {analysis.reasoning && (
                                            <div className="rounded-xl border bg-muted/30 p-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                        <Sparkles className="h-4 w-4 text-primary" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">
                                                            Analise da IA
                                                        </p>
                                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                                            {analysis.reasoning}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Reimagination - Caption Diff */}
                            {analysis.hasReimagination && analysis.suggestedCaption && (
                                <Card>
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle className="text-base flex items-center gap-2">
                                                    <Wand2 className="h-4 w-4 text-green-500" />
                                                    Legenda Reimaginada
                                                </CardTitle>
                                                <CardDescription>
                                                    Comparacao antes/depois com melhorias destacadas
                                                </CardDescription>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleCopy}
                                                className="gap-2"
                                            >
                                                {copied ? (
                                                    <>
                                                        <Check className="h-4 w-4 text-green-500" />
                                                        Copiado!
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="h-4 w-4" />
                                                        Copiar
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {/* Diff view */}
                                        <CaptionDiff
                                            original={analysis.currentCaption || ""}
                                            suggested={analysis.suggestedCaption}
                                        />

                                        {/* Improvements list */}
                                        {analysis.improvements && analysis.improvements.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                    Melhorias Aplicadas
                                                </p>
                                                <div className="space-y-2">
                                                    {analysis.improvements.map((imp, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="rounded-lg bg-green-500/5 border border-green-500/20 p-3 space-y-1"
                                                        >
                                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-green-600">
                                                                {imp.type}
                                                            </span>
                                                            <p className="text-sm">
                                                                <span className="text-muted-foreground line-through">
                                                                    {imp.issue}
                                                                </span>
                                                                <span className="mx-2">→</span>
                                                                <span className="font-medium">{imp.suggestion}</span>
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Reimagination reasoning */}
                                        {analysis.reasoning && !analysis.hasAnalysis && (
                                            <div className="rounded-xl border bg-muted/30 p-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                                                        <Sparkles className="h-4 w-4 text-green-500" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">
                                                            Por que essas mudancas?
                                                        </p>
                                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                                            {analysis.reasoning}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </>
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
                <ImageIcon className="h-8 w-8" />
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

function InsightCard({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {label}
                </span>
            </div>
            <p className="text-sm font-medium line-clamp-2">{value}</p>
        </div>
    );
}
