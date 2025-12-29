"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { useSidebar } from "./sidebar-context";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
    href: string;
    icon: IconSvgElement;
    label: string;
    onClick?: () => void;
}

export function SidebarItem({ href, icon, label, onClick }: SidebarItemProps) {
    const pathname = usePathname();
    const { isCollapsed, closeMobile } = useSidebar();

    const isActive = pathname === href || pathname.startsWith(`${href}/`);

    const handleClick = () => {
        closeMobile();
        onClick?.();
    };

    return (
        <Link
            href={href}
            onClick={handleClick}
            className={cn(
                // Base styles
                "flex items-center gap-2 rounded-none px-2 py-1.5 text-xs font-medium transition-all duration-100",
                // Inactive state
                "text-sidebar-foreground/70",
                "hover:text-sidebar-foreground hover:bg-sidebar-accent",
                // Active state
                isActive && [
                    "bg-primary/10 text-primary",
                    "ring-1 ring-primary/20",
                ].join(" "),
                isCollapsed && "justify-center px-0"
            )}
            title={isCollapsed ? label : undefined}
        >
            <HugeiconsIcon
                icon={icon}
                strokeWidth={2}
                className={cn(
                    "size-4 shrink-0 transition-colors",
                    isActive ? "text-primary" : ""
                )}
            />
            {!isCollapsed && (
                <span className="truncate">{label}</span>
            )}
        </Link>
    );
}
