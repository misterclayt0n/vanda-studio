"use client";

import { useState } from "react";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
    Copy,
    Check,
    ChevronLeft,
    ChevronRight,
    AlertCircle,
    CheckCircle2,
    Sparkles,
    ImageIcon,
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

interface PostDiffViewerProps {
    posts: PostWithStorageUrls[];
    analyses: Doc<"post_analysis">[];
}

export function PostDiffViewer({ posts, analyses }: PostDiffViewerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    // Create a map of post analyses for quick lookup
    const analysisMap = new Map(analyses.map((a) => [a.postId.toString(), a]));

    // Get posts that have analyses
    const postsWithAnalysis = posts
        .map((post) => ({
            post,
            analysis: analysisMap.get(post._id.toString()),
        }))
        .filter((item) => item.analysis !== undefined) as {
        post: PostWithStorageUrls;
        analysis: Doc<"post_analysis">;
    }[];

    if (postsWithAnalysis.length === 0) {
        return (
            <div className="text-center py-16 text-muted-foreground">
                <Sparkles className="h-10 w-10 mx-auto mb-4 opacity-30" />
                <p>Nenhuma análise de post disponível.</p>
            </div>
        );
    }

    const { post, analysis } = postsWithAnalysis[currentIndex];

    const goToPrev = () => setCurrentIndex((prev) => Math.max(0, prev - 1));
    const goToNext = () => setCurrentIndex((prev) => Math.min(postsWithAnalysis.length - 1, prev + 1));

    return (
        <div className="space-y-6">
            {/* Navigation header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={goToPrev}
                        disabled={currentIndex === 0}
                        className="h-8 w-8"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium tabular-nums">
                        {currentIndex + 1} / {postsWithAnalysis.length}
                    </span>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={goToNext}
                        disabled={currentIndex === postsWithAnalysis.length - 1}
                        className="h-8 w-8"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                    {new Date(post.timestamp).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                    })}
                    {post.likeCount !== undefined && post.likeCount >= 0 && (
                        <span className="ml-2">• {post.likeCount} curtidas</span>
                    )}
                </div>
            </div>

            {/* Main comparison grid */}
            <div className="grid grid-cols-2 gap-6">
                {/* Original */}
                <OriginalColumn post={post} analysis={analysis} />

                {/* Suggested */}
                <SuggestedColumn analysis={analysis} />
            </div>

            {/* AI Reasoning */}
            <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <p className="text-sm font-medium mb-1">Análise da IA</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {analysis.reasoning}
                        </p>
                    </div>
                </div>
            </div>

            {/* Dot indicators */}
            {postsWithAnalysis.length > 1 && (
                <div className="flex justify-center gap-1.5">
                    {postsWithAnalysis.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentIndex(idx)}
                            className={`h-2 rounded-full transition-all ${
                                idx === currentIndex
                                    ? "w-6 bg-primary"
                                    : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                            }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function OriginalColumn({
    post,
    analysis,
}: {
    post: PostWithStorageUrls;
    analysis: Doc<"post_analysis">;
}) {
    const scoreColor =
        analysis.score >= 80
            ? "text-green-500 bg-green-500/10"
            : analysis.score >= 60
              ? "text-yellow-500 bg-yellow-500/10"
              : "text-red-500 bg-red-500/10";

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                    <span className="text-sm font-medium">Original</span>
                </div>
                <div className={`px-2 py-0.5 rounded-md text-xs font-semibold ${scoreColor}`}>
                    {analysis.score}/100
                </div>
            </div>

            {/* Image */}
            <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={post.mediaStorageUrl || post.thumbnailStorageUrl || post.thumbnailUrl || post.mediaUrl}
                    alt="Post original"
                    className="h-full w-full object-cover"
                />
            </div>

            {/* Caption */}
            <div className="rounded-lg border p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Legenda
                </p>
                <p className="text-sm leading-relaxed">
                    {analysis.currentCaption || "(sem legenda)"}
                </p>
            </div>

            {/* Problems */}
            <div className="rounded-lg border p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Problemas identificados
                </p>
                {analysis.improvements.length > 0 ? (
                    <div className="space-y-2">
                        {analysis.improvements.map((improvement, idx) => (
                            <div key={idx} className="flex items-start gap-2.5">
                                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                                <div className="text-sm">
                                    <span className="font-medium">{improvement.type}</span>
                                    <span className="text-muted-foreground">: {improvement.issue}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">Nenhum problema identificado</p>
                )}
            </div>
        </div>
    );
}

function SuggestedColumn({ analysis }: { analysis: Doc<"post_analysis"> }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(analysis.suggestedCaption);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-sm font-medium">Sugerido</span>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-7 text-xs"
                >
                    {copied ? (
                        <>
                            <Check className="h-3.5 w-3.5" />
                            Copiado
                        </>
                    ) : (
                        <>
                            <Copy className="h-3.5 w-3.5" />
                            Copiar
                        </>
                    )}
                </Button>
            </div>

            {/* Image placeholder */}
            <div className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex flex-col items-center justify-center gap-3">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground">Imagem IA</p>
                    <p className="text-xs text-muted-foreground/70">Em breve</p>
                </div>
            </div>

            {/* Caption */}
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Legenda sugerida
                </p>
                <p className="text-sm leading-relaxed">
                    {analysis.suggestedCaption}
                </p>
            </div>

            {/* Improvements */}
            <div className="rounded-lg border p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Melhorias aplicadas
                </p>
                {analysis.improvements.length > 0 ? (
                    <div className="space-y-2">
                        {analysis.improvements.map((improvement, idx) => (
                            <div key={idx} className="flex items-start gap-2.5">
                                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                <div className="text-sm">
                                    <span className="font-medium">{improvement.type}</span>
                                    <span className="text-muted-foreground">: {improvement.suggestion}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">Post já otimizado</p>
                )}
            </div>
        </div>
    );
}
