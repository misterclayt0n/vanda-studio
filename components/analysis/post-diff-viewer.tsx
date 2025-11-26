"use client";

import { useState } from "react";
import { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
    Copy,
    Check,
    ArrowRight,
    Sparkles,
    AlertCircle,
    ImageIcon,
    Wand2,
} from "lucide-react";

interface PostDiffViewerProps {
    posts: Doc<"instagram_posts">[];
    analyses: Doc<"post_analysis">[];
}

export function PostDiffViewer({ posts, analyses }: PostDiffViewerProps) {
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

    if (postsWithAnalysis.length === 0) {
        return (
            <div className="text-center py-16 text-muted-foreground">
                <Sparkles className="h-10 w-10 mx-auto mb-4 opacity-30" />
                <p>Nenhuma analise de post disponivel.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {postsWithAnalysis.map(({ post, analysis }, index) => (
                <PostDiffPanel
                    key={post._id}
                    post={post}
                    analysis={analysis}
                    index={index + 1}
                    total={postsWithAnalysis.length}
                />
            ))}
        </div>
    );
}

function PostDiffPanel({
    post,
    analysis,
    index,
    total,
}: {
    post: Doc<"instagram_posts">;
    analysis: Doc<"post_analysis">;
    index: number;
    total: number;
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(analysis.suggestedCaption);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const scoreColor =
        analysis.score >= 80
            ? "text-green-500"
            : analysis.score >= 60
              ? "text-yellow-500"
              : "text-red-500";

    const scoreBg =
        analysis.score >= 80
            ? "bg-green-500/10 border-green-500/30"
            : analysis.score >= 60
              ? "bg-yellow-500/10 border-yellow-500/30"
              : "bg-red-500/10 border-red-500/30";

    return (
        <div className="rounded-xl border overflow-hidden">
            {/* Header with post number */}
            <div className="px-4 py-2 bg-muted/50 border-b flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                    Post {index} de {total}
                </span>
                <span className="text-xs text-muted-foreground">
                    {new Date(post.timestamp).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                    })}
                    {post.likeCount !== undefined && post.likeCount >= 0 && ` • ${post.likeCount} curtidas`}
                </span>
            </div>

            {/* Main content - two columns with arrow in middle */}
            <div className="flex">
                {/* LEFT COLUMN: Original */}
                <div className="flex-1 bg-red-500/5 border-r border-border">
                    {/* Header */}
                    <div className="px-4 py-2.5 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                            <span className="font-medium">Original</span>
                        </div>
                        <div className={`px-2.5 py-1 rounded border text-sm font-bold ${scoreBg} ${scoreColor}`}>
                            {analysis.score}/100
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex gap-5">
                        {/* Image */}
                        <div className="shrink-0">
                            <div className="h-40 w-40 rounded-lg overflow-hidden bg-muted">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={post.thumbnailUrl || post.mediaUrl}
                                    alt="Post original"
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        </div>

                        {/* Text content */}
                        <div className="flex-1 min-w-0 space-y-4">
                            {/* Caption */}
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Legenda</p>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                    {analysis.currentCaption || "(sem legenda)"}
                                </p>
                            </div>

                            {/* Problems */}
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Problemas Identificados</p>
                                {analysis.improvements.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {analysis.improvements.map((improvement, idx) => (
                                            <div key={idx} className="flex items-start gap-2 text-sm">
                                                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                                                <span>
                                                    <span className="font-medium text-red-400">{improvement.type}:</span>{" "}
                                                    <span className="text-muted-foreground">{improvement.issue}</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-green-500">Nenhum problema identificado</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* CENTER: Arrow */}
                <div className="w-14 bg-muted/30 flex items-center justify-center shrink-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                        <ArrowRight className="h-5 w-5 text-primary" />
                    </div>
                </div>

                {/* RIGHT COLUMN: Suggested */}
                <div className="flex-1 bg-green-500/5">
                    {/* Header */}
                    <div className="px-4 py-2.5 bg-green-500/10 border-b border-green-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                            <span className="font-medium">Sugerido</span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopy}
                            className="h-7"
                        >
                            {copied ? (
                                <>
                                    <Check className="h-3.5 w-3.5" />
                                    Copiado!
                                </>
                            ) : (
                                <>
                                    <Copy className="h-3.5 w-3.5" />
                                    Copiar Legenda
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex gap-5">
                        {/* Image placeholder */}
                        <div className="shrink-0">
                            <div className="h-40 w-40 rounded-lg overflow-hidden bg-muted/50 border-2 border-dashed border-green-500/30 flex flex-col items-center justify-center gap-2">
                                <Wand2 className="h-8 w-8 text-green-500/40" />
                                <p className="text-xs text-muted-foreground">IA em breve</p>
                                <Button variant="outline" size="sm" className="h-7 text-xs" disabled>
                                    <ImageIcon className="h-3.5 w-3.5" />
                                    Gerar Imagem
                                </Button>
                            </div>
                        </div>

                        {/* Text content */}
                        <div className="flex-1 min-w-0 space-y-4">
                            {/* Caption */}
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Legenda Sugerida</p>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                    {analysis.suggestedCaption}
                                </p>
                            </div>

                            {/* Improvements */}
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Melhorias Aplicadas</p>
                                {analysis.improvements.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {analysis.improvements.map((improvement, idx) => (
                                            <div key={idx} className="flex items-start gap-2 text-sm">
                                                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                                <span>
                                                    <span className="font-medium text-green-400">{improvement.type}:</span>{" "}
                                                    <span className="text-muted-foreground">{improvement.suggestion}</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-green-500">Post ja otimizado</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Reasoning footer */}
            <div className="px-5 py-3 bg-primary/5 border-t flex items-start gap-3">
                <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm leading-relaxed text-muted-foreground">
                    {analysis.reasoning}
                </p>
            </div>
        </div>
    );
}
