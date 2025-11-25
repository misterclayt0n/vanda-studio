"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoPost } from "@/components/video-post";
import { ArrowLeft, Instagram, Loader2 } from "lucide-react";

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
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <div>
                    <h1 className="text-2xl font-semibold">{project.name}</h1>
                    <p className="text-sm text-muted-foreground">{project.instagramUrl}</p>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>Perfil do Instagram</CardTitle>
                        <CardDescription>Resumo das informações coletadas</CardDescription>
                    </div>
                    <Button asChild variant="outline">
                        <Link href={project.instagramUrl} target="_blank" rel="noopener noreferrer">
                            <Instagram className="mr-2 h-4 w-4" /> Abrir Instagram
                        </Link>
                    </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-6 md:flex-row">
                    <div className="flex flex-col items-center gap-4 md:w-1/3">
                        <ProfilePicture
                            storageUrl={project.profilePictureStorageUrl}
                            externalUrl={project.profilePictureUrl}
                            alt={project.instagramHandle || project.name}
                            fallbackLetter={project.name.charAt(0).toUpperCase()}
                        />
                        <div className="text-center">
                            <p className="text-lg font-semibold">@{project.instagramHandle || extractHandle(project.instagramUrl)}</p>
                            {project.bio && <p className="text-sm text-muted-foreground mt-2 max-w-sm">{project.bio}</p>}
                            {project.website && (
                                <Link href={ensureUrl(project.website)} target="_blank" className="text-sm text-primary underline mt-2 block">
                                    {project.website}
                                </Link>
                            )}
                        </div>
                    </div>
                    <div className="grid gap-4 md:w-2/3 sm:grid-cols-3">
                        {stats.map((stat) => (
                            <div key={stat.label} className="rounded-lg border p-4 text-center">
                                <p className="text-2xl font-bold">{stat.value}</p>
                                <p className="text-sm text-muted-foreground">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Posts Recentes</CardTitle>
                    <CardDescription>Últimas publicações capturadas</CardDescription>
                </CardHeader>
                <CardContent>
                    {posts === undefined ? (
                        <div className="flex items-center gap-3 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <p>Carregando posts...</p>
                        </div>
                    ) : posts.length === 0 ? (
                        <p className="text-muted-foreground">Nenhum post coletado ainda.</p>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {posts.map((post: Doc<"instagram_posts">) => {
                                const mediaTypeUpper = post.mediaType?.toUpperCase() ?? "";
                                const isVideo = mediaTypeUpper === "VIDEO" || mediaTypeUpper === "REEL" || mediaTypeUpper === "CLIP" || mediaTypeUpper.includes("VIDEO");

                                return (
                                    <div
                                        key={post._id}
                                        className="group rounded-lg border overflow-hidden hover:border-primary/60 transition-colors"
                                    >
                                        {isVideo ? (
                                            <VideoPost
                                                mediaUrl={post.mediaUrl}
                                                thumbnailUrl={post.thumbnailUrl}
                                                caption={post.caption}
                                                permalink={post.permalink}
                                            />
                                        ) : (
                                            <Link href={post.permalink} target="_blank">
                                                <div className="aspect-square bg-muted overflow-hidden">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={post.mediaUrl}
                                                        alt={post.caption ?? "Post do Instagram"}
                                                        className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                                    />
                                                </div>
                                            </Link>
                                        )}
                                        <Link href={post.permalink} target="_blank" className="block p-4 space-y-2">
                                            <p className="text-sm text-muted-foreground line-clamp-2">{post.caption || "Sem legenda"}</p>
                                            <div className="text-xs text-muted-foreground flex items-center justify-between">
                                                <span>{post.likeCount ? `❤️ ${post.likeCount}` : "❤️ 0"}</span>
                                                <span>{new Date(post.timestamp).toLocaleDateString()}</span>
                                            </div>
                                        </Link>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
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
}: {
    storageUrl?: string | null;
    externalUrl?: string;
    alt: string;
    fallbackLetter: string;
}) {
    const [currentUrlIndex, setCurrentUrlIndex] = useState(0);

    // Build list of URLs to try in order
    const urls = [storageUrl, externalUrl].filter((url): url is string => Boolean(url));
    const currentUrl = urls[currentUrlIndex];

    if (!currentUrl) {
        return (
            <div className="h-32 w-32 rounded-full bg-muted flex items-center justify-center text-lg font-semibold">
                {fallbackLetter}
            </div>
        );
    }

    return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
            src={currentUrl}
            alt={alt}
            className="h-32 w-32 rounded-full object-cover"
            onError={() => {
                // Try next URL if available, otherwise show fallback
                if (currentUrlIndex < urls.length - 1) {
                    setCurrentUrlIndex(currentUrlIndex + 1);
                } else {
                    setCurrentUrlIndex(urls.length); // triggers fallback
                }
            }}
        />
    );
}
