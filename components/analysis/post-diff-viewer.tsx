"use client";

import { useState } from "react";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
    Copy,
    Check,
    AlertCircle,
    CheckCircle2,
    Sparkles,
    ImageIcon,
    Video,
    X,
    ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

function isVideoPost(post: PostWithStorageUrls): boolean {
    const mediaTypeUpper = post.mediaType?.toUpperCase() ?? "";
    return mediaTypeUpper === "VIDEO" || mediaTypeUpper === "REEL" || mediaTypeUpper === "CLIP" || mediaTypeUpper.includes("VIDEO");
}

export function PostDiffViewer({ posts, analyses }: PostDiffViewerProps) {
    const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

    // Create a map of post analyses for quick lookup
    const analysisMap = new Map(analyses.map((a) => [a.postId.toString(), a]));

    // Get all posts that have analyses
    const allPostsWithAnalysis = posts
        .map((post) => ({
            post,
            analysis: analysisMap.get(post._id.toString()),
            isVideo: isVideoPost(post),
        }))
        .filter((item) => item.analysis !== undefined) as {
        post: PostWithStorageUrls;
        analysis: Doc<"post_analysis">;
        isVideo: boolean;
    }[];

    // Separate image and video posts
    const imagePostsWithAnalysis = allPostsWithAnalysis.filter((item) => !item.isVideo);
    const videoCount = allPostsWithAnalysis.filter((item) => item.isVideo).length;

    if (allPostsWithAnalysis.length === 0) {
        return (
            <div className="text-center py-16 text-muted-foreground">
                <Sparkles className="h-10 w-10 mx-auto mb-4 opacity-30" />
                <p>Nenhuma analise de post disponivel.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Video posts notice */}
            {videoCount > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-muted-foreground/20">
                    <Video className="h-5 w-5 text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground">
                        {videoCount} {videoCount === 1 ? "video nao suportado" : "videos nao suportados"} no momento.
                    </p>
                </div>
            )}

            {/* If no image posts, show message */}
            {imagePostsWithAnalysis.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <Video className="h-10 w-10 mx-auto mb-4 opacity-30" />
                    <p>Apenas videos foram analisados.</p>
                    <p className="text-sm mt-1">Sugestoes para videos em breve.</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {imagePostsWithAnalysis.map(({ post, analysis }) => (
                        <SuggestionCard
                            key={post._id}
                            post={post}
                            analysis={analysis}
                            isExpanded={expandedPostId === post._id}
                            onToggle={() => setExpandedPostId(
                                expandedPostId === post._id ? null : post._id
                            )}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function SuggestionCard({
    post,
    analysis,
    isExpanded,
    onToggle,
}: {
    post: PostWithStorageUrls;
    analysis: Doc<"post_analysis">;
    isExpanded: boolean;
    onToggle: () => void;
}) {
    const scoreColor =
        analysis.score >= 80
            ? "bg-green-500"
            : analysis.score >= 60
              ? "bg-yellow-500"
              : "bg-red-500";

    const scoreRingColor =
        analysis.score >= 80
            ? "ring-green-500/30"
            : analysis.score >= 60
              ? "ring-yellow-500/30"
              : "ring-red-500/30";

    return (
        <div
            className={cn(
                "group rounded-xl border bg-card/50 backdrop-blur-sm overflow-hidden transition-all duration-300",
                isExpanded
                    ? "col-span-full ring-2 ring-primary/30"
                    : "hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            )}
        >
            {isExpanded ? (
                <ExpandedView
                    post={post}
                    analysis={analysis}
                    onClose={onToggle}
                />
            ) : (
                <CollapsedView
                    post={post}
                    analysis={analysis}
                    scoreColor={scoreColor}
                    scoreRingColor={scoreRingColor}
                    onExpand={onToggle}
                />
            )}
        </div>
    );
}

function CollapsedView({
    post,
    analysis,
    scoreColor,
    scoreRingColor,
    onExpand,
}: {
    post: PostWithStorageUrls;
    analysis: Doc<"post_analysis">;
    scoreColor: string;
    scoreRingColor: string;
    onExpand: () => void;
}) {
    return (
        <>
            {/* Image with overlay */}
            <div className="aspect-square relative overflow-hidden">
                <PostThumbnail post={post} />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {/* Score badge */}
                <div
                    className={cn(
                        "absolute top-3 right-3 px-2 py-1 rounded-lg text-xs font-bold text-white shadow-lg",
                        scoreColor
                    )}
                >
                    {analysis.score}/100
                </div>

                {/* Hover overlay with button */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onExpand}
                        className="glass-pink"
                    >
                        Ver Analise
                        <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            </div>

            {/* Caption preview */}
            <div className="p-3">
                <p className="text-sm line-clamp-2 text-muted-foreground">
                    {post.caption || "Sem legenda"}
                </p>
            </div>
        </>
    );
}

function ExpandedView({
    post,
    analysis,
    onClose,
}: {
    post: PostWithStorageUrls;
    analysis: Doc<"post_analysis">;
    onClose: () => void;
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(analysis.suggestedCaption);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const scoreColor =
        analysis.score >= 80
            ? "text-green-500 bg-green-500/10"
            : analysis.score >= 60
              ? "text-yellow-500 bg-yellow-500/10"
              : "text-red-500 bg-red-500/10";

    return (
        <div className="p-4">
            {/* Header with close button */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold">Analise do Post</h3>
                        <p className="text-xs text-muted-foreground">
                            Pontuacao: <span className={cn("font-bold px-1.5 py-0.5 rounded", scoreColor)}>{analysis.score}/100</span>
                        </p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Left column - Image and Original */}
                <div className="space-y-4">
                    {/* Image */}
                    <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                        <PostMedia post={post} />
                    </div>

                    {/* Original Caption */}
                    <div className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Legenda Original
                            </span>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {analysis.currentCaption || "(sem legenda)"}
                        </p>
                    </div>

                    {/* Problems */}
                    {analysis.improvements.length > 0 && (
                        <div className="rounded-lg border p-3 space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Problemas identificados
                            </p>
                            <div className="space-y-2">
                                {analysis.improvements.map((improvement, idx) => (
                                    <div key={idx} className="flex items-start gap-2">
                                        <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                                        <div className="text-sm">
                                            <span className="font-medium">{improvement.type}</span>
                                            <span className="text-muted-foreground">: {improvement.issue}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right column - Suggested */}
                <div className="space-y-4">
                    {/* Suggested Caption */}
                    <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Legenda Sugerida
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCopy}
                                className="h-7 text-xs"
                            >
                                {copied ? (
                                    <>
                                        <Check className="h-3.5 w-3.5 mr-1" />
                                        Copiado
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-3.5 w-3.5 mr-1" />
                                        Copiar
                                    </>
                                )}
                            </Button>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {analysis.suggestedCaption}
                        </p>
                    </div>

                    {/* Improvements */}
                    {analysis.improvements.length > 0 && (
                        <div className="rounded-lg border p-3 space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Melhorias aplicadas
                            </p>
                            <div className="space-y-2">
                                {analysis.improvements.map((improvement, idx) => (
                                    <div key={idx} className="flex items-start gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                        <div className="text-sm">
                                            <span className="font-medium">{improvement.type}</span>
                                            <span className="text-muted-foreground">: {improvement.suggestion}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* AI Reasoning */}
                    <div className="rounded-lg border bg-muted/30 p-3">
                        <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <Sparkles className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <p className="text-xs font-medium mb-1 text-muted-foreground">Analise da IA</p>
                                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                    {analysis.reasoning}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PostMedia({ post }: { post: PostWithStorageUrls }) {
    const [currentUrlIndex, setCurrentUrlIndex] = useState(0);

    // Build list of URLs to try in order of preference
    const urls = [post.mediaStorageUrl, post.thumbnailStorageUrl, post.mediaUrl, post.thumbnailUrl];
    const validUrls = urls.filter((url): url is string => Boolean(url));
    const currentUrl = validUrls[currentUrlIndex];

    if (!currentUrl || currentUrlIndex >= validUrls.length) {
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

function PostThumbnail({ post }: { post: PostWithStorageUrls }) {
    const [error, setError] = useState(false);

    const imageUrl = post.thumbnailStorageUrl || post.mediaStorageUrl || post.thumbnailUrl || post.mediaUrl;

    if (!imageUrl || error) {
        return (
            <div className="h-full w-full bg-muted flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
        );
    }

    return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
            src={imageUrl}
            alt="Post thumbnail"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            onError={() => setError(true)}
            referrerPolicy="no-referrer"
        />
    );
}
