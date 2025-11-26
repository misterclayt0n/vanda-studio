"use client";

import { useState } from "react";
import { Doc } from "@/convex/_generated/dataModel";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Copy,
    Check,
    Sparkles,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    Lightbulb,
} from "lucide-react";
import Link from "next/link";

interface PostAnalysisGridProps {
    posts: Doc<"instagram_posts">[];
    analyses: Doc<"post_analysis">[];
}

export function PostAnalysisGrid({ posts, analyses }: PostAnalysisGridProps) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    // Create a map of post analyses for quick lookup
    const analysisMap = new Map(analyses.map((a) => [a.postId.toString(), a]));

    // Get posts that have analyses
    const postsWithAnalysis = posts
        .map((post) => ({
            post,
            analysis: analysisMap.get(post._id.toString()),
        }))
        .filter((item) => item.analysis !== undefined) as {
        post: Doc<"instagram_posts">;
        analysis: Doc<"post_analysis">;
    }[];

    const selectedItem = selectedIndex !== null ? postsWithAnalysis[selectedIndex] : null;

    const goToPrevious = () => {
        if (selectedIndex !== null && selectedIndex > 0) {
            setSelectedIndex(selectedIndex - 1);
        }
    };

    const goToNext = () => {
        if (selectedIndex !== null && selectedIndex < postsWithAnalysis.length - 1) {
            setSelectedIndex(selectedIndex + 1);
        }
    };

    if (postsWithAnalysis.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Lightbulb className="h-8 w-8 mx-auto mb-4 opacity-50" />
                <p>Nenhuma analise de post disponivel.</p>
            </div>
        );
    }

    return (
        <>
            {/* Compact Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {postsWithAnalysis.map(({ post, analysis }, index) => (
                    <PostThumbnail
                        key={post._id}
                        post={post}
                        analysis={analysis}
                        onClick={() => setSelectedIndex(index)}
                    />
                ))}
            </div>

            {/* Detail Dialog */}
            <Dialog open={selectedIndex !== null} onOpenChange={(open) => !open && setSelectedIndex(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0">
                    {selectedItem && (
                        <PostAnalysisDetail
                            post={selectedItem.post}
                            analysis={selectedItem.analysis}
                            currentIndex={selectedIndex!}
                            totalCount={postsWithAnalysis.length}
                            onPrevious={goToPrevious}
                            onNext={goToNext}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function PostThumbnail({
    post,
    analysis,
    onClick,
}: {
    post: Doc<"instagram_posts">;
    analysis: Doc<"post_analysis">;
    onClick: () => void;
}) {
    const score = analysis.score ?? 0;
    const scoreColor =
        score >= 80
            ? "bg-green-500"
            : score >= 60
              ? "bg-yellow-500"
              : "bg-red-500";

    return (
        <button
            onClick={onClick}
            className="group relative aspect-square rounded-lg overflow-hidden bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
            {/* Post Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={post.thumbnailUrl || post.mediaUrl}
                alt="Post"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Score badge */}
            {analysis.score !== undefined && (
                <div
                    className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${scoreColor} shadow-sm`}
                >
                    {analysis.score}
                </div>
            )}

            {/* Suggestion indicator */}
            {analysis.hasReimagination && (
                <div className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
            )}
        </button>
    );
}

function PostAnalysisDetail({
    post,
    analysis,
    currentIndex,
    totalCount,
    onPrevious,
    onNext,
}: {
    post: Doc<"instagram_posts">;
    analysis: Doc<"post_analysis">;
    currentIndex: number;
    totalCount: number;
    onPrevious: () => void;
    onNext: () => void;
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (analysis.suggestedCaption) {
            await navigator.clipboard.writeText(analysis.suggestedCaption);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const score = analysis.score ?? 0;
    const scoreColor =
        score >= 80
            ? "text-green-500 bg-green-500/10"
            : score >= 60
              ? "text-yellow-500 bg-yellow-500/10"
              : "text-red-500 bg-red-500/10";

    return (
        <div className="flex flex-col h-full max-h-[90vh]">
            {/* Header */}
            <DialogHeader className="px-6 py-4 border-b shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <DialogTitle className="text-lg">
                            Sugestao de Melhoria
                        </DialogTitle>
                        {analysis.score !== undefined && (
                            <span className={`px-2 py-1 rounded-md text-sm font-bold ${scoreColor}`}>
                                {analysis.score}/100
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                            {currentIndex + 1} de {totalCount}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onPrevious}
                            disabled={currentIndex === 0}
                            className="h-8 w-8"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onNext}
                            disabled={currentIndex === totalCount - 1}
                            className="h-8 w-8"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </DialogHeader>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-6">
                    {/* Post preview */}
                    <div className="flex gap-4">
                        <Link
                            href={post.permalink}
                            target="_blank"
                            className="shrink-0 group"
                        >
                            <div className="h-24 w-24 rounded-lg overflow-hidden bg-muted relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={post.thumbnailUrl || post.mediaUrl}
                                    alt="Post"
                                    className="h-full w-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                    <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </div>
                        </Link>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground mb-1">
                                {new Date(post.timestamp).toLocaleDateString("pt-BR", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                })}
                                {post.likeCount !== undefined && post.likeCount >= 0 && (
                                    <span className="ml-2">• {post.likeCount} curtidas</span>
                                )}
                            </p>
                            <p className="text-sm text-muted-foreground line-clamp-3">
                                {analysis.currentCaption || "(sem legenda)"}
                            </p>
                        </div>
                    </div>

                    {/* AI Reasoning */}
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                        <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <p className="text-sm leading-relaxed">
                            {analysis.reasoning}
                        </p>
                    </div>

                    {/* Suggested Caption */}
                    {analysis.suggestedCaption && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-green-500" />
                                    Legenda Sugerida
                                </h4>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopy}
                                    className="h-8"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="h-3.5 w-3.5" />
                                            Copiado!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-3.5 w-3.5" />
                                            Copiar
                                        </>
                                    )}
                                </Button>
                            </div>
                            <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                    {analysis.suggestedCaption}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Improvements */}
                    {analysis.improvements && analysis.improvements.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold">
                                Pontos de Melhoria
                            </h4>
                            <div className="space-y-2">
                                {analysis.improvements.map((improvement, idx) => (
                                    <div
                                        key={idx}
                                        className="p-3 rounded-lg bg-muted/50 border border-border/50 space-y-1"
                                    >
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                            {improvement.type}
                                        </span>
                                        <p className="text-sm">
                                            <span className="text-muted-foreground line-through">
                                                {improvement.issue}
                                            </span>
                                            {" → "}
                                            <span className="font-medium">
                                                {improvement.suggestion}
                                            </span>
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
