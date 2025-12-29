"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, ImageNotFound01Icon } from "@hugeicons/core-free-icons";

type CarouselImage = {
    url: string;
    storageId?: string;
    storageUrl?: string | null;
};

interface CarouselPostProps {
    images: CarouselImage[];
    alt?: string;
}

export function CarouselPost({ images, alt = "Carousel image" }: CarouselPostProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

    if (images.length === 0) {
        return (
            <div className="aspect-square bg-muted flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <HugeiconsIcon icon={ImageNotFound01Icon} strokeWidth={2} className="size-6" />
                <span className="text-xs">Imagem indisponivel</span>
            </div>
        );
    }

    const goToPrevious = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    };

    const goToNext = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    };

    const handleImageError = (index: number) => {
        setFailedImages((prev) => new Set(prev).add(index));
    };

    const currentImage = images[currentIndex];
    const imageSrc = currentImage.storageUrl || currentImage.url;
    const hasFailed = failedImages.has(currentIndex);

    return (
        <div className="relative aspect-square bg-muted overflow-hidden group/carousel">
            {hasFailed ? (
                <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <HugeiconsIcon icon={ImageNotFound01Icon} strokeWidth={2} className="size-6" />
                    <span className="text-xs">Imagem indisponivel</span>
                </div>
            ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                    src={imageSrc}
                    alt={`${alt} ${currentIndex + 1}`}
                    className="h-full w-full object-cover"
                    onError={() => handleImageError(currentIndex)}
                />
            )}

            {/* Navigation arrows */}
            {images.length > 1 && (
                <>
                    <button
                        onClick={goToPrevious}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-foreground/60 hover:bg-foreground/80 text-background rounded-none p-1 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
                        aria-label="Previous image"
                    >
                        <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-4" />
                    </button>
                    <button
                        onClick={goToNext}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-foreground/60 hover:bg-foreground/80 text-background rounded-none p-1 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
                        aria-label="Next image"
                    >
                        <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
                    </button>
                </>
            )}

            {/* Dots indicator */}
            {images.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {images.map((_, index) => (
                        <button
                            key={index}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setCurrentIndex(index);
                            }}
                            className={`w-1.5 h-1.5 rounded-none transition-colors ${
                                index === currentIndex
                                    ? "bg-background"
                                    : "bg-background/50 hover:bg-background/75"
                            }`}
                            aria-label={`Go to image ${index + 1}`}
                        />
                    ))}
                </div>
            )}

            {/* Image counter */}
            {images.length > 1 && (
                <div className="absolute top-2 right-2 bg-foreground/60 text-background text-xs px-2 py-0.5 rounded-none">
                    {currentIndex + 1} / {images.length}
                </div>
            )}
        </div>
    );
}
