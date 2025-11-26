"use client";

import { useState } from "react";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Copy,
    Check,
    AlertCircle,
    CheckCircle2,
    Sparkles,
    ImageIcon,
    Video,
    Eye,
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
    const [selectedPost, setSelectedPost] = useState<{
        post: PostWithStorageUrls;
        analysis: Doc<"post_analysis">;
    } | null>(null);

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
        <>
            <div className="space-y-6">
                {/* Video posts notice */}
                {videoCount > 0 && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-muted-foreground/20">
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
                            <PostCard
                                key={post._id}
                                post={post}
                                analysis={analysis}
                                onSelect={() => setSelectedPost({ post, analysis })}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Analysis Dialog */}
            <Dialog open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
                <DialogContent size="xl" className="max-h-[90vh] overflow-y-auto">
                    {selectedPost && (
                        <AnalysisDialogContent
                            post={selectedPost.post}
                            analysis={selectedPost.analysis}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function PostCard({
    post,
    analysis,
    onSelect,
}: {
    post: PostWithStorageUrls;
    analysis: Doc<"post_analysis">;
    onSelect: () => void;
}) {
    const score = analysis.score ?? 0;
    const scoreColor =
        score >= 80
            ? "bg-green-500"
            : score >= 60
              ? "bg-yellow-500"
              : "bg-red-500";

    return (
        <div
            className="group rounded-xl border bg-card/50 backdrop-blur-sm overflow-hidden transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 cursor-pointer"
            onClick={onSelect}
        >
            {/* Image with overlay */}
            <div className="aspect-square relative overflow-hidden">
                <PostThumbnail post={post} />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {/* Score badge */}
                {analysis.score !== undefined && (
                    <div
                        className={cn(
                            "absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-lg",
                            scoreColor
                        )}
                    >
                        {analysis.score}/100
                    </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    <Button variant="secondary" size="sm" className="gap-2">
                        <Eye className="h-4 w-4" />
                        Ver Analise
                    </Button>
                </div>
            </div>

            {/* Caption preview */}
            <div className="p-3">
                <p className="text-sm line-clamp-2 text-muted-foreground">
                    {post.caption || "Sem legenda"}
                </p>
            </div>
        </div>
    );
}

function AnalysisDialogContent({
    post,
    analysis,
}: {
    post: PostWithStorageUrls;
    analysis: Doc<"post_analysis">;
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
            ? "text-green-500 bg-green-500/10 border-green-500/20"
            : score >= 60
              ? "text-yellow-500 bg-yellow-500/10 border-yellow-500/20"
              : "text-red-500 bg-red-500/10 border-red-500/20";

    return (
        <>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-pink flex items-center justify-center shadow-lg shadow-primary/20">
                        <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <span>Analise do Post</span>
                        <DialogDescription className="font-normal">
                            Veja os problemas identificados e sugestoes de melhoria
                        </DialogDescription>
                    </div>
                </DialogTitle>
            </DialogHeader>

            <div className="grid gap-6 md:grid-cols-2 mt-4">
                {/* Left column - Image and Original */}
                <div className="space-y-4">
                    {/* Image with score badge */}
                    <div className="relative">
                        <div className="aspect-square rounded-xl overflow-hidden bg-muted">
                            <PostMedia post={post} />
                        </div>
                        {analysis.score !== undefined && (
                            <div className={cn(
                                "absolute -top-2 -right-2 px-3 py-1.5 rounded-xl text-sm font-bold border shadow-lg",
                                scoreColor
                            )}>
                                {analysis.score}/100
                            </div>
                        )}
                    </div>

                    {/* Original Caption */}
                    <div className="rounded-xl border p-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Legenda Original
                            </span>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {analysis.currentCaption || "(sem legenda)"}
                        </p>
                    </div>

                    {/* Problems */}
                    {analysis.improvements && analysis.improvements.length > 0 && (
                        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Problemas identificados
                            </p>
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
                        </div>
                    )}
                </div>

                {/* Right column - Suggested */}
                <div className="space-y-4">
                    {/* Suggested Caption */}
                    {analysis.suggestedCaption && (
                        <div className="rounded-xl border-2 border-green-500/30 bg-green-500/5 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-green-500" />
                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Legenda Sugerida
                                    </span>
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
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                {analysis.suggestedCaption}
                            </p>
                        </div>
                    )}

                    {/* Improvements */}
                    {analysis.improvements && analysis.improvements.length > 0 && (
                        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Melhorias aplicadas
                            </p>
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
                        </div>
                    )}

                    {/* AI Reasoning */}
                    <div className="rounded-xl border bg-muted/30 p-4">
                        <div className="flex items-start gap-3">
                            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <Sparkles className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">
                                    Analise da IA
                                </p>
                                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                    {analysis.reasoning}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
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
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setError(true)}
            referrerPolicy="no-referrer"
        />
    );
}
