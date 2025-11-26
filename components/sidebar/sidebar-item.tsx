"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon } from "lucide-react";
import { useSidebar } from "./sidebar-context";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
    href: string;
    icon: LucideIcon;
    label: string;
    onClick?: () => void;
}

export function SidebarItem({ href, icon: Icon, label, onClick }: SidebarItemProps) {
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
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200",
                // Inactive state with subtle depth
                "text-sidebar-foreground/70",
                "hover:text-sidebar-foreground hover:bg-sidebar-accent/80",
                "hover:shadow-[0_1px_3px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.1)]",
                "active:scale-[0.98]",
                // Active state with primary styling
                isActive && [
                    "bg-gradient-to-r from-primary/15 to-primary/5",
                    "text-primary",
                    "shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.2)]",
                    "border border-primary/20",
                ].join(" "),
                isCollapsed && "justify-center px-2"
            )}
            title={isCollapsed ? label : undefined}
        >
            <Icon
                className={cn(
                    "h-5 w-5 shrink-0 transition-all duration-200",
                    isActive ? "text-primary" : "group-hover:scale-110"
                )}
            />
            {!isCollapsed && (
                <span className="truncate">{label}</span>
            )}
        </Link>
    );
}
