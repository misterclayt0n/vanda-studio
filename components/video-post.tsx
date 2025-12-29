"use client";

import { useState, useRef, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlayIcon, Cancel01Icon, ImageNotFound01Icon } from "@hugeicons/core-free-icons";

interface VideoPostProps {
    mediaUrl: string;
    thumbnailUrl?: string;
    caption?: string;
    permalink: string;
}

export function VideoPost({ mediaUrl, thumbnailUrl }: VideoPostProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [thumbnailError, setThumbnailError] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (isPlaying && videoRef.current) {
            videoRef.current.play();
        }
    }, [isPlaying]);

    if (isPlaying) {
        return (
            <div className="relative aspect-square bg-foreground">
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsPlaying(false);
                    }}
                    className="absolute top-2 right-2 z-10 rounded-none bg-foreground/60 p-1 text-background hover:bg-foreground/80 transition-colors"
                    aria-label="Fechar video"
                >
                    <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4" />
                </button>
                <video
                    ref={videoRef}
                    src={mediaUrl}
                    controls
                    autoPlay
                    playsInline
                    className="absolute inset-0 w-full h-full object-contain"
                />
            </div>
        );
    }

    const showThumbnail = thumbnailUrl && !thumbnailError;

    return (
        <div
            className="relative aspect-square bg-muted overflow-hidden cursor-pointer"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsPlaying(true);
            }}
        >
            {showThumbnail ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                    src={thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => setThumbnailError(true)}
                />
            ) : (
                <div className="h-full w-full flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
                    <HugeiconsIcon icon={ImageNotFound01Icon} strokeWidth={2} className="size-6" />
                    <span className="text-xs">Thumbnail indisponivel</span>
                </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-none bg-foreground/50 p-3">
                    <HugeiconsIcon icon={PlayIcon} strokeWidth={2} className="size-6 text-background" />
                </div>
            </div>
        </div>
    );
}
