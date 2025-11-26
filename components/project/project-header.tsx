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
            className="sticky top-0 z-20 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 bg-background/80 backdrop-blur-xl border-b border-border/50"
        >
            {/* Always visible top bar */}
            <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => router.push("/dashboard")}
                        className="shrink-0"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>

                    {/* Profile picture with size transition */}
                    <div className="relative">
                        <ProfilePicture
                            storageUrl={project.profilePictureStorageUrl}
                            externalUrl={project.profilePictureUrl}
                            alt={handle}
                            fallbackLetter={project.name.charAt(0).toUpperCase()}
                            isCompact={isCompact}
                        />
                    </div>

                    <div className={cn(
                        "transition-all duration-300 ease-out overflow-hidden",
                        isCompact ? "max-w-[200px]" : "max-w-[300px]"
                    )}>
                        <h1 className={cn(
                            "font-semibold transition-all duration-300 ease-out whitespace-nowrap",
                            isCompact ? "text-sm" : "text-lg"
                        )}>
                            @{handle}
                        </h1>
                        <p className={cn(
                            "text-sm text-muted-foreground whitespace-nowrap transition-all duration-300 ease-out",
                            isCompact ? "opacity-0 h-0" : "opacity-100 h-5"
                        )}>
                            {project.name}
                        </p>
                    </div>

                    {/* Inline stats for compact mode */}
                    <div className={cn(
                        "hidden sm:flex items-center gap-4 ml-2 text-xs text-muted-foreground transition-all duration-300 ease-out",
                        isCompact ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none absolute"
                    )}>
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
                        <span className={cn(
                            "transition-all duration-300 ease-out overflow-hidden",
                            isCompact ? "w-0 opacity-0" : "w-auto opacity-100 ml-2"
                        )}>
                            <span className="hidden sm:inline whitespace-nowrap">Ver Instagram</span>
                        </span>
                    </Link>
                </Button>
            </div>

            {/* Expandable content section */}
            <div
                className={cn(
                    "grid transition-all duration-300 ease-out",
                    isCompact
                        ? "grid-rows-[0fr] opacity-0"
                        : "grid-rows-[1fr] opacity-100"
                )}
            >
                <div className="overflow-hidden">
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3 pb-4">
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
                        <p className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-4 pb-4">
                            {project.bio}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

function ProfilePicture({
    storageUrl,
    externalUrl,
    alt,
    fallbackLetter,
    isCompact,
}: {
    storageUrl?: string | null;
    externalUrl?: string;
    alt: string;
    fallbackLetter: string;
    isCompact: boolean;
}) {
    const [currentUrlIndex, setCurrentUrlIndex] = useState(0);

    const urls = [storageUrl, externalUrl].filter((url): url is string => Boolean(url));
    const currentUrl = urls[currentUrlIndex];

    const sizeClasses = cn(
        "rounded-full object-cover shrink-0 transition-all duration-300 ease-out",
        isCompact ? "h-8 w-8" : "h-12 w-12"
    );

    if (!currentUrl || currentUrlIndex >= urls.length) {
        return (
            <div
                className={cn(
                    sizeClasses,
                    "bg-muted flex items-center justify-center font-semibold text-sm"
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
            className={sizeClasses}
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
