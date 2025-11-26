"use client";

import { useState } from "react";
import { Doc } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    MessageCircle,
    ChevronDown,
    ChevronUp,
    Copy,
    Check,
    AlertCircle,
    Sparkles,
    Minus,
    Plus,
} from "lucide-react";
import Link from "next/link";

interface PostDiffCardProps {
    post: Doc<"instagram_posts">;
    analysis: Doc<"post_analysis">;
}

export function PostDiffCard({ post, analysis }: PostDiffCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
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
            ? "text-green-500"
            : score >= 60
              ? "text-yellow-500"
              : "text-red-500";

    const scoreBg =
        score >= 80
            ? "bg-green-500/10"
            : score >= 60
              ? "bg-yellow-500/10"
              : "bg-red-500/10";

    return (
        <Card className="overflow-hidden">
            <CardHeader className="pb-3">
                <div className="flex items-start gap-4">
                    {/* Post thumbnail */}
                    <Link
                        href={post.permalink}
                        target="_blank"
                        className="shrink-0"
                    >
                        <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={post.thumbnailUrl || post.mediaUrl}
                                alt="Post"
                                className="h-full w-full object-cover hover:scale-105 transition-transform"
                            />
                        </div>
                    </Link>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <CardTitle className="text-base truncate">
                                {post.mediaType === "VIDEO" || post.mediaType === "REEL"
                                    ? "Vídeo"
                                    : post.mediaType === "CAROUSEL_ALBUM"
                                      ? "Carrossel"
                                      : "Imagem"}
                            </CardTitle>
                            {analysis.score !== undefined && (
                                <div className={`px-2 py-1 rounded-md text-sm font-bold ${scoreBg} ${scoreColor}`}>
                                    {analysis.score}/100
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {new Date(post.timestamp).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                            })}
                            {post.likeCount !== undefined && (
                                <span className="ml-2">• {post.likeCount} curtidas</span>
                            )}
                        </p>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Diff view */}
                <div className="rounded-lg border border-border/50 overflow-hidden font-mono text-sm">
                    {/* Current caption (red) */}
                    <div className="bg-red-500/5 border-b border-red-500/20 p-3">
                        <div className="flex items-center gap-2 text-red-500 text-xs font-semibold mb-2">
                            <Minus className="h-3 w-3" />
                            <span>Legenda Atual</span>
                        </div>
                        <p className="text-muted-foreground whitespace-pre-wrap text-xs leading-relaxed">
                            {analysis.currentCaption || "(sem legenda)"}
                        </p>
                    </div>

                    {/* Suggested caption (green) */}
                    {analysis.suggestedCaption && (
                        <div className="bg-green-500/5 p-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-green-500 text-xs font-semibold">
                                    <Plus className="h-3 w-3" />
                                    <span>Legenda Sugerida</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCopy}
                                    className="h-6 px-2 text-xs"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="h-3 w-3" />
                                            Copiado
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-3 w-3" />
                                            Copiar
                                        </>
                                    )}
                                </Button>
                            </div>
                            <p className="whitespace-pre-wrap text-xs leading-relaxed">
                                {analysis.suggestedCaption}
                            </p>
                        </div>
                    )}
                </div>

                {/* AI Reasoning */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {analysis.reasoning}
                    </p>
                </div>

                {/* Improvements toggle */}
                {analysis.improvements && analysis.improvements.length > 0 && (
                    <div>
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <MessageCircle className="h-4 w-4" />
                            {analysis.improvements.length} sugestões de melhoria
                            {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </button>

                        {isExpanded && (
                            <div className="mt-3 space-y-2">
                                {analysis.improvements.map((improvement, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/30"
                                    >
                                        <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                    {improvement.type}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                <span className="line-through">{improvement.issue}</span>
                                            </p>
                                            <p className="text-sm font-medium">
                                                {improvement.suggestion}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
