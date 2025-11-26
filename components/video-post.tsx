"use client";

import { useState, useRef, useEffect } from "react";
import { Play, X, ImageOff } from "lucide-react";

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
            <div className="relative aspect-square bg-black">
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsPlaying(false);
                    }}
                    className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors"
                    aria-label="Fechar vídeo"
                >
                    <X className="h-4 w-4" />
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
                    <ImageOff className="h-8 w-8" />
                    <span className="text-xs">Thumbnail indisponível</span>
                </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-full bg-black/50 p-3">
                    <Play className="h-8 w-8 text-white fill-white" />
                </div>
            </div>
        </div>
    );
}
