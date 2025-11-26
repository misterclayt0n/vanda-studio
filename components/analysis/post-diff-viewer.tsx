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

function isVideoPost(post: PostWithStorageUrls): boolean {
    const mediaTypeUpper = post.mediaType?.toUpperCase() ?? "";
    return mediaTypeUpper === "VIDEO" || mediaTypeUpper === "REEL" || mediaTypeUpper === "CLIP" || mediaTypeUpper.includes("VIDEO");
}

export function PostDiffViewer({ posts, analyses }: PostDiffViewerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

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

    // Ensure currentIndex is valid
    const safeIndex = Math.min(Math.max(0, currentIndex), imagePostsWithAnalysis.length - 1);
    const currentItem = imagePostsWithAnalysis[safeIndex];

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
                <>
                    {/* Post selector grid */}
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
                        {imagePostsWithAnalysis.map(({ post: p, analysis: a }, idx) => {
                            const isSelected = idx === safeIndex;
                            const scoreColor = a.score >= 80 ? "bg-green-500" : a.score >= 60 ? "bg-yellow-500" : "bg-red-500";
                            
                            return (
                                <button
                                    key={p._id}
                                    onClick={() => setCurrentIndex(idx)}
                                    className={`relative aspect-square rounded-lg overflow-hidden bg-muted transition-all ${
                                        isSelected 
                                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
                                            : "opacity-60 hover:opacity-100"
                                    }`}
                                >
                                    <PostThumbnail key={p._id} post={p} />
                                    <div className={`absolute top-1 right-1 px-1 py-0.5 rounded text-[10px] font-bold text-white ${scoreColor}`}>
                                        {a.score}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Main comparison grid */}
                    {currentItem && (
                        <>
                            <div key={currentItem.post._id} className="grid grid-cols-2 gap-6">
                                <OriginalColumn post={currentItem.post} analysis={currentItem.analysis} />
                                <SuggestedColumn analysis={currentItem.analysis} />
                            </div>

                            {/* AI Reasoning */}
                            <div className="rounded-lg border bg-muted/30 p-4">
                                <div className="flex items-start gap-3">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <Sparkles className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium mb-1">Analise da IA</p>
                                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                            {currentItem.analysis.reasoning}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Dot indicators */}
                            {imagePostsWithAnalysis.length > 1 && (
                                <div className="flex justify-center gap-1.5">
                                    {imagePostsWithAnalysis.map((_, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setCurrentIndex(idx)}
                                            className={`h-2 rounded-full transition-all ${
                                                idx === safeIndex
                                                    ? "w-6 bg-primary"
                                                    : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                                            }`}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </>
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
            <PostMedia post={post} />

            {/* Caption */}
            <div className="rounded-lg border p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Legenda
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
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
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
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
                    <p className="text-sm text-muted-foreground">Post ja otimizado</p>
                )}
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
            <div className="aspect-square rounded-lg overflow-hidden bg-muted flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
                <span className="text-xs">Imagem indisponivel</span>
            </div>
        );
    }

    return (
        <div className="aspect-square rounded-lg overflow-hidden bg-muted relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={currentUrl}
                alt="Post original"
                className="h-full w-full object-cover"
                onError={() => setCurrentUrlIndex((prev) => prev + 1)}
            />
        </div>
    );
}

function PostThumbnail({ post }: { post: PostWithStorageUrls }) {
    const [error, setError] = useState(false);
    
    const imageUrl = post.thumbnailStorageUrl || post.mediaStorageUrl || post.thumbnailUrl || post.mediaUrl;

    if (!imageUrl || error) {
        return (
            <div className="h-full w-full bg-muted flex items-center justify-center">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </div>
        );
    }

    return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
            src={imageUrl}
            alt="Post thumbnail"
            className="h-full w-full object-cover"
            onError={() => setError(true)}
            referrerPolicy="no-referrer"
        />
    );
}
