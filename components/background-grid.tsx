"use client";

import { cn } from "@/lib/utils";

export function BackgroundGrid({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "absolute inset-0 -z-10 h-full w-full bg-background",
                className
            )}
        >
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] dark:bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,#fff_70%,transparent_100%)] opacity-20" />
        </div>
    );
}
