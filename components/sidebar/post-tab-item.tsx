"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Image01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { OpenPostTab, usePostTabs } from "./post-tabs-context";
import { useSidebar } from "./sidebar-context";
import { useState } from "react";

interface PostTabItemProps {
    tab: OpenPostTab;
    onSelect: () => void;
}

export function PostTabItem({ tab, onSelect }: PostTabItemProps) {
    const { activePostId, closePost } = usePostTabs();
    const { isCollapsed, closeMobile } = useSidebar();
    const [imageError, setImageError] = useState(false);

    const isActive = activePostId === tab.postId;

    const handleClick = () => {
        closeMobile();
        onSelect();
    };

    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        closePost(tab.postId);
    };

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={(e) => e.key === "Enter" && handleClick()}
            className={cn(
                // Base styles
                "w-full flex items-center gap-2 rounded-none px-2 py-1.5 text-xs transition-all duration-100 group cursor-pointer",
                // Inactive state
                "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                // Active state
                isActive && "bg-primary/10 text-primary ring-1 ring-primary/20",
                isCollapsed && "justify-center px-0"
            )}
            title={isCollapsed ? (tab.caption || "Post") : undefined}
        >
            {/* Thumbnail */}
            <div className={cn(
                "h-6 w-6 rounded-none overflow-hidden bg-muted flex-shrink-0 ring-1",
                isActive ? "ring-primary/30" : "ring-border/30"
            )}>
                {tab.thumbnailUrl && !imageError ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                        src={tab.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div className="h-full w-full flex items-center justify-center">
                        <HugeiconsIcon icon={Image01Icon} strokeWidth={2} className="size-3 text-muted-foreground" />
                    </div>
                )}
            </div>

            {/* Caption preview */}
            {!isCollapsed && (
                <>
                    <span className="flex-1 truncate text-left text-xs">
                        {tab.caption ? (
                            tab.caption.slice(0, 30) + (tab.caption.length > 30 ? "..." : "")
                        ) : (
                            <span className="italic text-muted-foreground">Sem legenda</span>
                        )}
                    </span>

                    {/* Close button */}
                    <button
                        onClick={handleClose}
                        className={cn(
                            "h-5 w-5 rounded-none flex items-center justify-center transition-all",
                            "opacity-0 group-hover:opacity-100",
                            "hover:bg-destructive/10 hover:text-destructive"
                        )}
                    >
                        <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3" />
                    </button>
                </>
            )}
        </div>
    );
}
