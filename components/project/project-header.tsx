"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Instagram } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectHeaderProps {
    project: {
        name: string;
        instagramHandle?: string | null;
        instagramUrl: string;
        profilePictureStorageUrl?: string | null;
        profilePictureUrl?: string;
        bio?: string | null;
        followersCount?: number | null;
        followingCount?: number | null;
        postsCount?: number | null;
    };
}

export function ProjectHeader({ project }: ProjectHeaderProps) {
    const router = useRouter();
    const [isCompact, setIsCompact] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsCompact(window.scrollY > 120);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const handle = project.instagramHandle || extractHandle(project.instagramUrl);

    const stats = [
        { label: "Seguidores", value: formatNumber(project.followersCount) },
        { label: "Seguindo", value: formatNumber(project.followingCount) },
        { label: "Posts", value: formatNumber(project.postsCount) },
    ];

    return (
        <div
            className={cn(
                "sticky top-0 z-20 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 bg-background/80 backdrop-blur-xl border-b border-border/50 transition-all duration-300",
                isCompact ? "py-3" : "py-6"
            )}
        >
            {/* Compact Header */}
            <div
                className={cn(
                    "flex items-center justify-between transition-all duration-300",
                    isCompact ? "opacity-100" : "opacity-0 absolute pointer-events-none"
                )}
            >
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push("/dashboard")}
                        className="h-8 w-8 shrink-0"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <ProfilePicture
                        storageUrl={project.profilePictureStorageUrl}
                        externalUrl={project.profilePictureUrl}
                        alt={handle}
                        fallbackLetter={project.name.charAt(0).toUpperCase()}
                        size="xs"
                    />
                    <span className="font-semibold text-sm">@{handle}</span>
                    <div className="hidden sm:flex items-center gap-4 ml-4 text-xs text-muted-foreground">
                        {stats.map((stat) => (
                            <span key={stat.label}>
                                <span className="font-semibold text-foreground">{stat.value}</span>{" "}
                                {stat.label.toLowerCase()}
                            </span>
                        ))}
                    </div>
                </div>
                <Button asChild variant="outline" size="sm">
                    <Link href={project.instagramUrl} target="_blank" rel="noopener noreferrer">
                        <Instagram className="h-4 w-4" />
                    </Link>
                </Button>
            </div>

            {/* Full Header */}
            <div
                className={cn(
                    "transition-all duration-300",
                    isCompact ? "opacity-0 absolute pointer-events-none" : "opacity-100"
                )}
            >
                {/* Top row: back button + profile info + instagram link */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push("/dashboard")}
                            className="h-9 w-9 shrink-0"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <ProfilePicture
                                storageUrl={project.profilePictureStorageUrl}
                                externalUrl={project.profilePictureUrl}
                                alt={handle}
                                fallbackLetter={project.name.charAt(0).toUpperCase()}
                                size="md"
                            />
                            <div>
                                <h1 className="text-lg font-semibold">@{handle}</h1>
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
                <div className="grid grid-cols-3 gap-3 mb-4">
                    {stats.map((stat) => (
                        <div
                            key={stat.label}
                            className="rounded-xl border bg-card/50 backdrop-blur-sm p-3 text-center"
                        >
                            <p className="text-xl font-bold tabular-nums">{stat.value}</p>
                            <p className="text-xs text-muted-foreground">{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* Bio if present */}
                {project.bio && (
                    <p className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-4">
                        {project.bio}
                    </p>
                )}
            </div>
        </div>
    );
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
    size?: "xs" | "sm" | "md";
}) {
    const [currentUrlIndex, setCurrentUrlIndex] = useState(0);

    const sizeClasses = {
        xs: "h-7 w-7 text-xs",
        sm: "h-10 w-10 text-sm",
        md: "h-14 w-14 text-base",
    };

    const urls = [storageUrl, externalUrl].filter((url): url is string => Boolean(url));
    const currentUrl = urls[currentUrlIndex];

    if (!currentUrl || currentUrlIndex >= urls.length) {
        return (
            <div
                className={cn(
                    sizeClasses[size],
                    "rounded-full bg-muted flex items-center justify-center font-semibold shrink-0"
                )}
            >
                {fallbackLetter}
            </div>
        );
    }

    return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
            src={currentUrl}
            alt={alt}
            className={cn(sizeClasses[size], "rounded-full object-cover shrink-0")}
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
