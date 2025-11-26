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
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive
                    ? "bg-sidebar-primary/10 text-sidebar-primary"
                    : "text-sidebar-foreground/70",
                isCollapsed && "justify-center px-2"
            )}
            title={isCollapsed ? label : undefined}
        >
            <Icon
                className={cn(
                    "h-5 w-5 shrink-0 transition-colors",
                    isActive && "text-sidebar-primary"
                )}
            />
            {!isCollapsed && (
                <span className="truncate">{label}</span>
            )}
        </Link>
    );
}
