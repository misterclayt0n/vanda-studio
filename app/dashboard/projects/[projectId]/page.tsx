"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CarouselPost } from "@/components/carousel-post";
import { ArrowLeft, Instagram, Loader2, ImageOff, FileText, Wand2, Grid3X3, Video } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalysisSection } from "@/components/analysis";

export default function ProjectDetailsPage() {
    const params = useParams<{ projectId: string }>();
    const router = useRouter();
    const projectId = (params?.projectId || "") as Id<"projects">;

    const project = useQuery(
        api.projects.get,
        projectId ? { projectId } : "skip",
    );

    const posts = useQuery(
        api.instagramPosts.listByProject,
        projectId ? { projectId } : "skip",
    );

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

    const stats = [
        { label: "Seguidores", value: formatNumber(project.followersCount) },
        { label: "Seguindo", value: formatNumber(project.followingCount) },
        { label: "Posts", value: formatNumber(project.postsCount) },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")} className="h-9 w-9">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <ProfilePicture
                            storageUrl={project.profilePictureStorageUrl}
                            externalUrl={project.profilePictureUrl}
                            alt={project.instagramHandle || project.name}
                            fallbackLetter={project.name.charAt(0).toUpperCase()}
                            size="sm"
                        />
                        <div>
                            <h1 className="text-lg font-semibold">@{project.instagramHandle || extractHandle(project.instagramUrl)}</h1>
                            <p className="text-sm text-muted-foreground">{project.name}</p>
                        </div>
                    </div>
                </div>
                <Button asChild variant="outline" size="sm">
                    <Link href={project.instagramUrl} target="_blank" rel="noopener noreferrer">
                        <Instagram className="h-4 w-4" />
                        <span className="hidden sm:inline ml-2">Ver Instagram</span>
                    </Link>
                </Button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
                {stats.map((stat) => (
                    <div key={stat.label} className="rounded-xl border bg-card p-4 text-center">
                        <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Bio if present */}
            {project.bio && (
                <p className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-4">{project.bio}</p>
            )}

            {/* Tabbed Sections */}
            <Tabs defaultValue="strategy" className="w-full">
                <TabsList className="w-full h-12 p-1 bg-muted/50 rounded-xl">
                    <TabsTrigger value="strategy" className="flex-1 h-full rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="hidden sm:inline">Estrategia</span>
                    </TabsTrigger>
                    <TabsTrigger value="suggestions" className="flex-1 h-full rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                        <Wand2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Sugestoes</span>
                    </TabsTrigger>
                    <TabsTrigger value="posts" className="flex-1 h-full rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
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

                <TabsContent value="suggestions" className="mt-6">
                    {posts && posts.length > 0 ? (
                        <AnalysisSection projectId={projectId} posts={posts} view="suggestions" />
                    ) : (
                        <EmptyTabContent message="Carregue posts para ver sugestoes." />
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
                        <PostsGrid posts={posts} />
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

function formatNumber(value?: number | null) {
    if (typeof value !== "number") return "-";
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toLocaleString("pt-BR");
}

function extractHandle(url: string) {
    try {
        const parsed = new URL(url);
        const [handle] = parsed.pathname.split("/").filter(Boolean);
        return handle || "conta";
    } catch {
        return url;
    }
}

function ensureUrl(url: string) {
    if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
    }
    return `https://${url}`;
}

function ProfilePicture({
    storageUrl,
    externalUrl,
    alt,
    fallbackLetter,
    size = "md",
}: {
    storageUrl?: string | null;
    externalUrl?: string;
    alt: string;
    fallbackLetter: string;
    size?: "sm" | "md";
}) {
    const [currentUrlIndex, setCurrentUrlIndex] = useState(0);

    const sizeClasses = size === "sm" ? "h-10 w-10 text-sm" : "h-32 w-32 text-lg";

    // Build list of URLs to try in order
    const urls = [storageUrl, externalUrl].filter((url): url is string => Boolean(url));
    const currentUrl = urls[currentUrlIndex];

    if (!currentUrl || currentUrlIndex >= urls.length) {
        return (
            <div className={`${sizeClasses} rounded-full bg-muted flex items-center justify-center font-semibold`}>
                {fallbackLetter}
            </div>
        );
    }

    return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
            src={currentUrl}
            alt={alt}
            className={`${sizeClasses} rounded-full object-cover`}
            onError={() => {
                if (currentUrlIndex < urls.length - 1) {
                    setCurrentUrlIndex(currentUrlIndex + 1);
                } else {
                    setCurrentUrlIndex(urls.length);
                }
            }}
        />
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

type PostWithStorageUrls = {
    _id: string;
    mediaType?: string;
    mediaStorageUrl: string | null;
    thumbnailStorageUrl: string | null;
    mediaUrl: string;
    thumbnailUrl?: string;
    caption?: string;
    permalink: string;
    likeCount?: number;
    timestamp: string;
    carouselImagesWithUrls?: {
        url: string;
        storageUrl?: string | null;
    }[];
};

function isVideoPost(post: PostWithStorageUrls): boolean {
    const mediaTypeUpper = post.mediaType?.toUpperCase() ?? "";
    return mediaTypeUpper === "VIDEO" || mediaTypeUpper === "REEL" || mediaTypeUpper === "CLIP" || mediaTypeUpper.includes("VIDEO");
}

function PostsGrid({ posts }: { posts: PostWithStorageUrls[] }) {
    const imagePosts = posts.filter((post) => !isVideoPost(post));
    const videoCount = posts.length - imagePosts.length;

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

                        return (
                            <div
                                key={post._id}
                                className="group rounded-xl border bg-card overflow-hidden hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/5"
                            >
                                {isCarousel && hasCarouselImages ? (
                                    <CarouselPost
                                        images={post.carouselImagesWithUrls!}
                                        alt={post.caption ?? "Post do Instagram"}
                                    />
                                ) : (
                                    <Link href={post.permalink} target="_blank" className="block">
                                        <PostImage
                                            src={mediaSrc}
                                            fallbackSrc={thumbnailSrc}
                                            alt={post.caption ?? "Post do Instagram"}
                                        />
                                    </Link>
                                )}
                                <Link href={post.permalink} target="_blank" className="block p-3 space-y-2">
                                    <p className="text-sm line-clamp-2">{post.caption || "Sem legenda"}</p>
                                    <div className="text-xs text-muted-foreground flex items-center justify-between">
                                        <span>{post.likeCount !== undefined && post.likeCount >= 0 ? `${post.likeCount} curtidas` : ""}</span>
                                        <span>{new Date(post.timestamp).toLocaleDateString("pt-BR")}</span>
                                    </div>
                                </Link>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
