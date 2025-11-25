"use client";

import { cn } from "@/lib/utils";

export function BackgroundGrid({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "absolute inset-0 -z-10 h-full w-full bg-background overflow-hidden",
                className
            )}
        >
            {/* Subtle grid pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--gradient-start)_1px,transparent_1px),linear-gradient(to_bottom,var(--gradient-start)_1px,transparent_1px)] bg-[size:64px_64px] opacity-[0.03]" />

            {/* Top gradient glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_center,var(--glow-purple),transparent_70%)] opacity-60 blur-3xl" />

            {/* Secondary accent glow */}
            <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-[radial-gradient(circle_at_center,var(--glow-pink),transparent_70%)] opacity-40 blur-3xl" />

            {/* Bottom subtle glow */}
            <div className="absolute bottom-0 left-1/4 w-[600px] h-[400px] bg-[radial-gradient(ellipse_at_center,var(--glow-purple),transparent_70%)] opacity-30 blur-3xl" />

            {/* Noise texture overlay for depth */}
            <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }} />
        </div>
    );
}
