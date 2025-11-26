"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { CarouselPost } from "@/components/carousel-post";
import { ProjectHeader } from "@/components/project";
import { ArrowLeft, Loader2, ImageOff, FileText, Grid3X3, Video, Sparkles, BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalysisSection, PostDetailView } from "@/components/analysis";
import { usePostTabs } from "@/components/sidebar";

export default function ProjectDetailsPage() {
    const params = useParams<{ projectId: string }>();
    const router = useRouter();
    const projectId = (params?.projectId || "") as Id<"projects">;

    const { openPost, openTabs, activePostId, setActivePost } = usePostTabs();

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

    // Find the selected post for detail view
    const selectedPost = selectedPostId && posts
        ? posts.find((p) => p._id === selectedPostId)
        : null;

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

            {/* Tabbed Sections - Merged into Strategy and Posts */}
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
                </TabsList>

                <TabsContent value="strategy" className="mt-6">
                    {posts && posts.length > 0 ? (
                        <AnalysisSection projectId={projectId} posts={posts} view="strategy" />
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
                        <PostsGrid posts={posts} onPostClick={handleOpenPost} />
                    )}
                </TabsContent>
            </Tabs>
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

function PostsGrid({ posts, onPostClick }: { posts: PostWithStorageUrls[]; onPostClick: (post: PostWithStorageUrls) => void }) {
    const imagePosts = posts.filter((post) => !isVideoPost(post));
    const videoCount = posts.length - imagePosts.length;

    // Get post analyses to show indicator
    const postAnalyses = useQuery(api.ai.analysisMutations.listPostAnalyses, {
        projectId: posts[0]?.projectId,
    });

    const analysisMap = new Map(postAnalyses?.map((a) => [a.postId.toString(), a]) ?? []);

    return (
        <div className="space-y-4">
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
                        const hasReimagination = analysis?.hasReimagination;
                        const score = analysis?.score;

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
                                onClick={() => onPostClick(post)}
                                className="group rounded-xl border bg-card overflow-hidden hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/5 cursor-pointer"
                            >
                                <div className="relative">
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

                                    {/* Analysis indicators */}
                                    <div className="absolute bottom-2 left-2 flex gap-1.5">
                                        {hasAnalysis && (
                                            <div className="h-6 w-6 rounded-full bg-primary/90 flex items-center justify-center shadow-lg" title="Analisado">
                                                <BarChart3 className="h-3 w-3 text-white" />
                                            </div>
                                        )}
                                        {hasReimagination && (
                                            <div className="h-6 w-6 rounded-full bg-green-500/90 flex items-center justify-center shadow-lg" title="Reimaginado">
                                                <Sparkles className="h-3 w-3 text-white" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Hover overlay */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                        <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                            Ver detalhes
                                        </span>
                                    </div>
                                </div>

                                <div className="p-3 space-y-2">
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
