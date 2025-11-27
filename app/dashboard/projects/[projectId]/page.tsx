"use client";

import { useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { CarouselPost } from "@/components/carousel-post";
import { ProjectHeader } from "@/components/project";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, ImageOff, FileText, Grid3X3, Video, BarChart3, CheckCircle2, Sparkles, Circle, Wand2, Copy, Check, Trash2, Download, Camera, Palette, Minimize2, Brush, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AnalysisSection, PostDetailView } from "@/components/analysis";
import { usePostTabs } from "@/components/sidebar";
import { cn } from "@/lib/utils";

export default function ProjectDetailsPage() {
    const params = useParams<{ projectId: string }>();
    const router = useRouter();
    const projectId = (params?.projectId || "") as Id<"projects">;

    const { openPost, openTabs, activePostId, setActivePost } = usePostTabs();

    // Selection state for batch analysis
    const [selectedPostIds, setSelectedPostIds] = useState<Set<Id<"instagram_posts">>>(new Set());
    const [isAnalyzingBatch, setIsAnalyzingBatch] = useState(false);
    const [batchError, setBatchError] = useState<string | null>(null);

    // Generation state
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [additionalContext, setAdditionalContext] = useState("");
    const [imageStyle, setImageStyle] = useState<"realistic" | "illustrative" | "minimalist" | "artistic">("realistic");
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);

    const analyzePost = useAction(api.ai.postAnalysis.analyzePost);
    const generatePost = useAction(api.ai.postGeneration.generatePost);

    // Derive selected post ID from context - no need for local state
    const selectedPostId = useMemo(() => {
        if (activePostId) {
            // Check if this post is for the current project
            const tab = openTabs.find((t) => t.postId === activePostId && t.projectId === projectId);
            if (tab) {
                return activePostId;
            }
        }
        return null;
    }, [activePostId, openTabs, projectId]);

    const project = useQuery(
        api.projects.get,
        projectId ? { projectId } : "skip",
    );

    const posts = useQuery(
        api.instagramPosts.listByProject,
        projectId ? { projectId } : "skip",
    );

    // Context readiness for generation
    const contextStatus = useQuery(
        api.generatedPosts.checkContextReady,
        projectId ? { projectId } : "skip"
    );

    // User quota for generation (2 credits needed per post)
    const quota = useQuery(api.billing.usage.checkQuota, {});

    // Generated posts
    const generatedPosts = useQuery(
        api.generatedPosts.listByProject,
        projectId ? { projectId } : "skip"
    );

    // Find the selected post for detail view
    const selectedPost = selectedPostId && posts
        ? posts.find((p) => p._id === selectedPostId)
        : null;

    // Toggle post selection
    const togglePostSelection = useCallback((postId: Id<"instagram_posts">) => {
        setSelectedPostIds((prev) => {
            const next = new Set(prev);
            if (next.has(postId)) {
                next.delete(postId);
            } else {
                next.add(postId);
            }
            return next;
        });
    }, []);

    // Handle batch analysis of selected posts
    const handleAnalyzeSelected = useCallback(async () => {
        if (selectedPostIds.size === 0) return;

        setIsAnalyzingBatch(true);
        setBatchError(null);

        const postIdsArray = Array.from(selectedPostIds);
        let successCount = 0;

        for (const postId of postIdsArray) {
            try {
                await analyzePost({ projectId, postId });
                successCount++;
            } catch (err) {
                console.error(`Failed to analyze post ${postId}:`, err);
                setBatchError(
                    err instanceof Error
                        ? err.message
                        : `Erro ao analisar ${postIdsArray.length - successCount} posts`
                );
                break;
            }
        }

        setIsAnalyzingBatch(false);
        // Clear selection after successful analysis
        if (successCount === postIdsArray.length) {
            setSelectedPostIds(new Set());
        }
    }, [selectedPostIds, analyzePost, projectId]);

    // Handle post generation
    const handleGenerate = useCallback(async () => {
        setIsGenerating(true);
        setGenerateError(null);
        try {
            await generatePost({
                projectId,
                additionalContext: additionalContext.trim() || undefined,
                imageStyle,
            });
            setShowCreateDialog(false);
            setAdditionalContext("");
            setImageStyle("realistic");
        } catch (err) {
            console.error("Failed to generate post:", err);
            setGenerateError(err instanceof Error ? err.message : "Erro ao gerar post");
        } finally {
            setIsGenerating(false);
        }
    }, [generatePost, projectId, additionalContext, imageStyle]);

    // Handle opening a post
    const handleOpenPost = (post: PostWithStorageUrls) => {
        // Open the post in sidebar and set it as active
        openPost({
            postId: post._id,
            projectId,
            thumbnailUrl: post.thumbnailStorageUrl || post.mediaStorageUrl || post.thumbnailUrl || post.mediaUrl,
            caption: post.caption || null,
        });
    };

    // Handle closing post detail
    const handleClosePostDetail = () => {
        setActivePost(null);
    };

    if (!projectId) {
        return (
            <div className="space-y-4">
                <p className="text-muted-foreground">Projeto inválido.</p>
                <Button onClick={() => router.push("/dashboard")}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
            </div>
        );
    }

    if (project === undefined) {
        return (
            <div className="flex flex-col items-center justify-center py-24 space-y-4 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p>Carregando projeto...</p>
            </div>
        );
    }

    if (project === null) {
        return (
            <div className="space-y-4">
                <p className="text-muted-foreground">Projeto não encontrado.</p>
                <Button onClick={() => router.push("/dashboard")}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
            </div>
        );
    }

    if (project.isFetching) {
        return (
            <div className="flex flex-col items-center justify-center py-24 space-y-6">
                <div className="relative h-28 w-28">
                    <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
                    <div className="absolute inset-4 rounded-full border-4 border-primary/30 animate-pulse"></div>
                    <div className="absolute inset-8 rounded-full border-4 border-primary/60 animate-spin border-t-transparent"></div>
                </div>
                <div className="text-center space-y-2">
                    <p className="text-lg font-semibold">Coletando perfil do Instagram...</p>
                    <p className="text-sm text-muted-foreground">
                        Isso pode levar alguns segundos enquanto buscamos posts e métricas da conta.
                    </p>
                </div>
                <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o dashboard
                </Button>
            </div>
        );
    }

    // If a post is selected, show the detail view
    if (selectedPost) {
        return (
            <div className="space-y-6">
                <ProjectHeader project={project} />
                <PostDetailView
                    post={selectedPost}
                    projectId={projectId}
                    onBack={handleClosePostDetail}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Project Header with compact-on-scroll */}
            <ProjectHeader project={project} />

            {/* Context Progress & Create Button */}
            <ContextProgressCard
                contextStatus={contextStatus}
                isReady={contextStatus?.isReady ?? false}
                onCreateClick={() => setShowCreateDialog(true)}
                quota={quota}
            />

            {/* Tabbed Sections */}
            <Tabs defaultValue="strategy" className="w-full">
                <TabsList className="w-full">
                    <TabsTrigger value="strategy">
                        <FileText className="h-4 w-4" />
                        <span className="hidden sm:inline">Estrategia</span>
                    </TabsTrigger>
                    <TabsTrigger value="posts">
                        <Grid3X3 className="h-4 w-4" />
                        <span className="hidden sm:inline">Posts</span>
                    </TabsTrigger>
                    <TabsTrigger value="generated" className="relative">
                        <Wand2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Posts Gerados</span>
                        {generatedPosts && generatedPosts.length > 0 && (
                            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                                {generatedPosts.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="strategy" className="mt-6">
                    {posts && posts.length > 0 ? (
                        <AnalysisSection projectId={projectId} />
                    ) : (
                        <EmptyTabContent message="Carregue posts para gerar analise de estrategia." />
                    )}
                </TabsContent>

                <TabsContent value="posts" className="mt-6">
                    {posts === undefined ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : posts.length === 0 ? (
                        <EmptyTabContent message="Nenhum post coletado ainda." />
                    ) : (
                        <PostsGrid
                            posts={posts}
                            onPostClick={handleOpenPost}
                            selectedPostIds={selectedPostIds}
                            onToggleSelect={togglePostSelection}
                            onAnalyzeSelected={handleAnalyzeSelected}
                            isAnalyzing={isAnalyzingBatch}
                            error={batchError}
                        />
                    )}
                </TabsContent>

                <TabsContent value="generated" className="mt-6">
                    {generatedPosts === undefined ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : generatedPosts.length === 0 ? (
                        <div className="rounded-xl border border-dashed bg-muted/30 py-16 text-center">
                            <Wand2 className="h-10 w-10 mx-auto mb-4 text-muted-foreground opacity-30" />
                            <p className="text-muted-foreground">Nenhum post gerado ainda.</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Execute a analise de marca e clique em &quot;Criar Post&quot; para gerar conteudo.
                            </p>
                        </div>
                    ) : (
                        <GeneratedPostsGrid posts={generatedPosts} />
                    )}
                </TabsContent>
            </Tabs>

            {/* Create Post Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Criar Novo Post</DialogTitle>
                        <DialogDescription>
                            A IA vai gerar um post baseado na sua marca e posts analisados.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Context summary */}
                        <div className="rounded-lg bg-muted p-3 text-sm">
                            <p className="font-medium mb-1">Contexto disponivel:</p>
                            <ul className="list-disc list-inside text-muted-foreground space-y-1">
                                <li>Analise de marca {contextStatus?.hasStrategy ? "✓" : "pendente"}</li>
                                <li>{contextStatus?.analyzedCount ?? 0} posts analisados</li>
                            </ul>
                        </div>

                        {/* Image style selector */}
                        <div className="space-y-2">
                            <Label>Estilo da imagem</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { value: "realistic" as const, label: "Realista", icon: Camera, desc: "Foto profissional" },
                                    { value: "illustrative" as const, label: "Ilustrativo", icon: Palette, desc: "Arte digital" },
                                    { value: "minimalist" as const, label: "Minimalista", icon: Minimize2, desc: "Clean e simples" },
                                    { value: "artistic" as const, label: "Artistico", icon: Brush, desc: "Criativo e ousado" },
                                ].map((style) => (
                                    <button
                                        key={style.value}
                                        type="button"
                                        onClick={() => setImageStyle(style.value)}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                                            imageStyle === style.value
                                                ? "border-primary bg-primary/10 ring-1 ring-primary"
                                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                                        )}
                                    >
                                        <div className={cn(
                                            "flex h-9 w-9 items-center justify-center rounded-lg",
                                            imageStyle === style.value ? "bg-primary text-primary-foreground" : "bg-muted"
                                        )}>
                                            <style.icon className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{style.label}</p>
                                            <p className="text-xs text-muted-foreground">{style.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Additional context input */}
                        <div className="space-y-2">
                            <Label htmlFor="context">Contexto adicional (opcional)</Label>
                            <Textarea
                                id="context"
                                placeholder="Tom desejado, tema especifico, promocao, data comemorativa..."
                                value={additionalContext}
                                onChange={(e) => setAdditionalContext(e.target.value)}
                                rows={3}
                            />
                        </div>

                        {/* Error display */}
                        {generateError && (
                            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                                {generateError}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleGenerate} disabled={isGenerating || !contextStatus?.isReady}>
                            {isGenerating ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Gerando...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Gerar Post
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function EmptyTabContent({ message }: { message: string }) {
    return (
        <div className="rounded-xl border border-dashed bg-muted/30 py-16 text-center">
            <p className="text-muted-foreground">{message}</p>
        </div>
    );
}

function PostImage({ src, fallbackSrc, alt }: { src: string; fallbackSrc?: string; alt: string }) {
    const [currentUrlIndex, setCurrentUrlIndex] = useState(0);

    const urls = [src, fallbackSrc].filter((url): url is string => Boolean(url));
    const currentUrl = urls[currentUrlIndex];

    if (!currentUrl || currentUrlIndex >= urls.length) {
        return (
            <div className="aspect-square bg-muted flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageOff className="h-8 w-8" />
                <span className="text-xs">Imagem indisponivel</span>
            </div>
        );
    }

    return (
        <div className="aspect-square bg-muted overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={currentUrl}
                alt={alt}
                className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                onError={() => setCurrentUrlIndex((prev) => prev + 1)}
            />
        </div>
    );
}

type PostWithStorageUrls = Doc<"instagram_posts"> & {
    mediaStorageUrl: string | null;
    thumbnailStorageUrl: string | null;
    carouselImagesWithUrls?: {
        url: string;
        storageId?: Id<"_storage">;
        storageUrl?: string | null;
    }[];
};

function isVideoPost(post: PostWithStorageUrls): boolean {
    const mediaTypeUpper = post.mediaType?.toUpperCase() ?? "";
    return mediaTypeUpper === "VIDEO" || mediaTypeUpper === "REEL" || mediaTypeUpper === "CLIP" || mediaTypeUpper.includes("VIDEO");
}

interface PostsGridProps {
    posts: PostWithStorageUrls[];
    onPostClick: (post: PostWithStorageUrls) => void;
    selectedPostIds: Set<Id<"instagram_posts">>;
    onToggleSelect: (postId: Id<"instagram_posts">) => void;
    onAnalyzeSelected: () => void;
    isAnalyzing: boolean;
    error: string | null;
}

function PostsGrid({
    posts,
    onPostClick,
    selectedPostIds,
    onToggleSelect,
    onAnalyzeSelected,
    isAnalyzing,
    error,
}: PostsGridProps) {
    const imagePosts = posts.filter((post) => !isVideoPost(post));
    const videoCount = posts.length - imagePosts.length;

    // Get post analyses to show indicator
    const postAnalyses = useQuery(api.ai.analysisMutations.listPostAnalyses, {
        projectId: posts[0]?.projectId,
    });

    const analysisMap = new Map(postAnalyses?.map((a) => [a.postId.toString(), a]) ?? []);

    // Count selected and analyzed posts
    const selectedCount = selectedPostIds.size;
    const analyzedCount = postAnalyses?.filter((a) => a.hasAnalysis).length ?? 0;

    // Filter selected posts that are not yet analyzed
    const selectedNotAnalyzed = Array.from(selectedPostIds).filter((id) => {
        const analysis = analysisMap.get(id.toString());
        return !analysis?.hasAnalysis;
    });

    return (
        <div className="space-y-4">
            {/* Selection header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border bg-muted/30">
                <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{selectedCount}</span> selecionados
                        <span className="mx-2">•</span>
                        <span className="font-medium text-foreground">{analyzedCount}</span> analisados
                    </p>
                    {analyzedCount >= 3 && (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Contexto pronto
                        </Badge>
                    )}
                </div>
                <Button
                    onClick={onAnalyzeSelected}
                    disabled={selectedNotAnalyzed.length === 0 || isAnalyzing}
                    size="sm"
                    className="gap-2"
                >
                    {isAnalyzing ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Analisando...
                        </>
                    ) : (
                        <>
                            <BarChart3 className="h-4 w-4" />
                            Analisar Selecionados ({selectedNotAnalyzed.length})
                        </>
                    )}
                </Button>
            </div>

            {/* Error display */}
            {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                    {error}
                </div>
            )}

            {/* Video notice */}
            {videoCount > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-muted-foreground/20">
                    <Video className="h-5 w-5 text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground">
                        {videoCount} {videoCount === 1 ? "video nao suportado" : "videos nao suportados"} no momento.
                    </p>
                </div>
            )}

            {/* If no image posts */}
            {imagePosts.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/30 py-16 text-center">
                    <Video className="h-10 w-10 mx-auto mb-4 text-muted-foreground opacity-30" />
                    <p className="text-muted-foreground">Apenas videos foram coletados.</p>
                    <p className="text-sm text-muted-foreground mt-1">Suporte a videos em breve.</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {imagePosts.map((post) => {
                        const mediaTypeUpper = post.mediaType?.toUpperCase() ?? "";
                        const isCarousel = mediaTypeUpper === "CAROUSEL_ALBUM";
                        const hasCarouselImages = (post.carouselImagesWithUrls?.length ?? 0) > 0;

                        const mediaSrc = post.mediaStorageUrl || post.mediaUrl;
                        const thumbnailSrc = post.thumbnailStorageUrl || post.thumbnailUrl;

                        const analysis = analysisMap.get(post._id.toString());
                        const hasAnalysis = analysis?.hasAnalysis;
                        const score = analysis?.score;
                        const isSelected = selectedPostIds.has(post._id);

                        const scoreColor =
                            score !== undefined
                                ? score >= 80
                                    ? "bg-green-500"
                                    : score >= 60
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                                : "";

                        return (
                            <div
                                key={post._id}
                                className={cn(
                                    "group rounded-xl border bg-card overflow-hidden transition-all hover:shadow-lg hover:shadow-primary/5",
                                    isSelected && "border-primary ring-2 ring-primary/20",
                                    hasAnalysis && !isSelected && "border-green-500/30",
                                    !isSelected && !hasAnalysis && "hover:border-primary/40"
                                )}
                            >
                                <div className="relative">
                                    {/* Selection checkbox */}
                                    <div
                                        className="absolute top-2 left-2 z-10"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleSelect(post._id);
                                        }}
                                    >
                                        <Checkbox
                                            checked={isSelected}
                                            className={cn(
                                                "h-5 w-5 border-2 bg-white/80 backdrop-blur-sm shadow-sm",
                                                isSelected && "bg-primary border-primary"
                                            )}
                                        />
                                    </div>

                                    <div
                                        onClick={() => onPostClick(post)}
                                        className="cursor-pointer"
                                    >
                                        {isCarousel && hasCarouselImages ? (
                                            <CarouselPost
                                                images={post.carouselImagesWithUrls!}
                                                alt={post.caption ?? "Post do Instagram"}
                                            />
                                        ) : (
                                            <PostImage
                                                src={mediaSrc}
                                                fallbackSrc={thumbnailSrc}
                                                alt={post.caption ?? "Post do Instagram"}
                                            />
                                        )}

                                        {/* Score badge */}
                                        {score !== undefined && (
                                            <div
                                                className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-xs font-bold text-white shadow-lg ${scoreColor}`}
                                            >
                                                {score}
                                            </div>
                                        )}

                                        {/* Analysis indicator */}
                                        {hasAnalysis && (
                                            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/90 shadow-lg">
                                                <CheckCircle2 className="h-3 w-3 text-white" />
                                                <span className="text-[10px] font-medium text-white">Analisado</span>
                                            </div>
                                        )}

                                        {/* Hover overlay */}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center pointer-events-none">
                                            <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                Ver detalhes
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    className="p-3 space-y-2 cursor-pointer"
                                    onClick={() => onPostClick(post)}
                                >
                                    <p className="text-sm line-clamp-2">{post.caption || "Sem legenda"}</p>
                                    <div className="text-xs text-muted-foreground flex items-center justify-between">
                                        <span>{post.likeCount !== undefined && post.likeCount >= 0 ? `${post.likeCount} curtidas` : ""}</span>
                                        <span>{new Date(post.timestamp).toLocaleDateString("pt-BR")}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// Context Progress Card
interface ContextProgressCardProps {
    contextStatus: {
        hasStrategy: boolean;
        analyzedCount: number;
        isReady: boolean;
        requiredPosts: number;
        hasLimitedContext?: boolean;
    } | undefined;
    isReady: boolean;
    onCreateClick: () => void;
    quota: {
        hasQuota: boolean;
        remaining: number;
        limit: number;
        used: number;
    } | null | undefined;
}

function ContextProgressCard({ contextStatus, isReady, onCreateClick, quota }: ContextProgressCardProps) {
    const hasStrategy = contextStatus?.hasStrategy ?? false;
    const analyzedCount = contextStatus?.analyzedCount ?? 0;
    const requiredPosts = contextStatus?.requiredPosts ?? 3;
    const hasLimitedContext = contextStatus?.hasLimitedContext ?? true;
    const progressPercent = Math.min((analyzedCount / requiredPosts) * 100, 100);

    const creditsRequired = 2;
    const hasEnoughCredits = (quota?.remaining ?? 0) >= creditsRequired;
    const canCreate = isReady && hasEnoughCredits;

    return (
        <div className="rounded-xl border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Contexto para Geracao</h3>
                <div title={!canCreate && !hasEnoughCredits ? "Creditos insuficientes" : undefined}>
                    <Button
                        onClick={onCreateClick}
                        disabled={!canCreate}
                        className={cn(
                            "gap-2",
                            canCreate && "animate-pulse bg-gradient-to-r from-primary to-green-500 hover:from-primary/90 hover:to-green-500/90"
                        )}
                        size="sm"
                    >
                        <Sparkles className="h-4 w-4" />
                        Criar Post
                    </Button>
                </div>
            </div>

            <div className="space-y-3">
                {/* Strategy check */}
                <div className="flex items-center gap-2 text-sm">
                    {hasStrategy ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={hasStrategy ? "text-foreground" : "text-muted-foreground"}>
                        Analise de marca
                    </span>
                </div>

                {/* Posts progress */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                        {analyzedCount >= requiredPosts ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                        <span className={analyzedCount >= requiredPosts ? "text-foreground" : "text-yellow-600 dark:text-yellow-400"}>
                            Posts analisados ({analyzedCount}/{requiredPosts})
                        </span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                </div>
            </div>

            {!canCreate && hasEnoughCredits && !hasStrategy && (
                <p className="text-xs text-muted-foreground">
                    Execute a analise de marca na aba Estrategia.
                </p>
            )}

            {canCreate && hasLimitedContext && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <p className="text-yellow-600 dark:text-yellow-400">
                        Poucos posts analisados. A geracao pode ser menos precisa. Analise mais posts para melhores resultados.
                    </p>
                </div>
            )}
        </div>
    );
}

// Type for generated posts with image URL
type GeneratedPostWithImage = Doc<"generated_posts"> & {
    imageUrl: string | null;
};

// Generated Posts Grid
function GeneratedPostsGrid({ posts }: { posts: GeneratedPostWithImage[] }) {
    const [selectedPost, setSelectedPost] = useState<GeneratedPostWithImage | null>(null);

    return (
        <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {posts.map((post) => (
                    <GeneratedPostCard
                        key={post._id}
                        post={post}
                        onClick={() => setSelectedPost(post)}
                    />
                ))}
            </div>

            {/* Detail Dialog */}
            <Dialog open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    {selectedPost && (
                        <GeneratedPostDetail
                            post={selectedPost}
                            onClose={() => setSelectedPost(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

// Generated Post Card (Grid item)
function GeneratedPostCard({ post, onClick }: { post: GeneratedPostWithImage; onClick: () => void }) {
    const [imageError, setImageError] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(post.caption);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div
            className="group rounded-xl border bg-card overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:shadow-primary/5 hover:border-primary/40"
            onClick={onClick}
        >
            {/* Image */}
            <div className="relative aspect-square bg-muted">
                {post.imageUrl && !imageError ? (
                    <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={post.imageUrl}
                            alt="Imagem gerada por IA"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            onError={() => setImageError(true)}
                        />
                        <Badge className="absolute top-2 right-2 bg-purple-600/90 hover:bg-purple-600">
                            <Sparkles className="h-3 w-3 mr-1" />
                            IA
                        </Badge>
                    </>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Wand2 className="h-8 w-8 opacity-30" />
                        <span className="text-xs">Sem imagem</span>
                    </div>
                )}

                {/* Quick copy button */}
                <button
                    onClick={handleCopy}
                    className="absolute bottom-2 right-2 p-2 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                    title="Copiar legenda"
                >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                    <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        Ver detalhes
                    </span>
                </div>
            </div>

            {/* Caption preview */}
            <div className="p-3 space-y-2">
                <p className="text-sm line-clamp-2">{post.caption}</p>
                <div className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>
                        {new Date(post.createdAt).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                        })}
                    </span>
                    {post.status === "edited" && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Editado</Badge>}
                </div>
            </div>
        </div>
    );
}

// Generated Post Detail (Dialog content)
function GeneratedPostDetail({ post, onClose }: { post: GeneratedPostWithImage; onClose: () => void }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedCaption, setEditedCaption] = useState(post.caption);
    const [copied, setCopied] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [imageError, setImageError] = useState(false);

    const updateCaption = useMutation(api.generatedPosts.updateCaption);
    const deletePost = useMutation(api.generatedPosts.remove);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(post.caption);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSave = async () => {
        if (editedCaption === post.caption) {
            setIsEditing(false);
            return;
        }
        setIsSaving(true);
        try {
            await updateCaption({ id: post._id, caption: editedCaption });
            setIsEditing(false);
        } catch (err) {
            console.error("Failed to save:", err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        await deletePost({ id: post._id });
        onClose();
    };

    const handleDownload = async () => {
        if (!post.imageUrl) return;
        try {
            const response = await fetch(post.imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `post-gerado-${post._id}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Failed to download:", err);
        }
    };

    return (
        <div className="space-y-4">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    Post Gerado
                </DialogTitle>
                <DialogDescription>
                    Gerado em {new Date(post.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                    {post.status === "edited" && " • Editado"}
                </DialogDescription>
            </DialogHeader>

            {/* Image */}
            {post.imageUrl && !imageError && (
                <div className="relative rounded-lg overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={post.imageUrl}
                        alt="Imagem gerada por IA"
                        className="w-full max-h-[400px] object-contain"
                        onError={() => setImageError(true)}
                    />
                    <Button
                        variant="secondary"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={handleDownload}
                    >
                        <Download className="h-4 w-4 mr-1" />
                        Baixar
                    </Button>
                </div>
            )}

            {/* Caption */}
            <div className="space-y-2">
                <Label>Legenda</Label>
                {isEditing ? (
                    <Textarea
                        value={editedCaption}
                        onChange={(e) => setEditedCaption(e.target.value)}
                        rows={6}
                        className="resize-none"
                    />
                ) : (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{post.caption}</p>
                    </div>
                )}
            </div>

            {/* AI reasoning */}
            {post.reasoning && (
                <details className="text-sm text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground transition-colors font-medium">
                        Por que essa legenda?
                    </summary>
                    <p className="mt-2 pl-4 border-l-2 border-muted">{post.reasoning}</p>
                </details>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-4 border-t">
                {isEditing ? (
                    <>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Salvar
                        </Button>
                        <Button variant="outline" onClick={() => {
                            setIsEditing(false);
                            setEditedCaption(post.caption);
                        }}>
                            Cancelar
                        </Button>
                    </>
                ) : (
                    <>
                        <Button variant="outline" onClick={() => setIsEditing(true)}>
                            Editar
                        </Button>
                        <Button variant="outline" onClick={handleCopy}>
                            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                            Copiar
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" className="text-destructive hover:text-destructive ml-auto">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir post gerado?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acao nao pode ser desfeita. O post gerado sera permanentemente excluido.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Excluir
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </>
                )}
            </div>
        </div>
    );
}
