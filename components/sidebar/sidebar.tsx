"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { LayoutDashboard, Settings, PanelLeftClose, PanelLeftOpen, Menu, X } from "lucide-react";
import { useSidebar } from "./sidebar-context";
import { SidebarItem } from "./sidebar-item";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Sidebar() {
    const { isCollapsed, isMobileOpen, toggle, closeMobile } = useSidebar();

    return (
        <>
            {/* Mobile overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
                    onClick={closeMobile}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out",
                    // Desktop
                    "md:relative md:translate-x-0",
                    isCollapsed ? "md:w-16" : "md:w-60",
                    // Mobile
                    "w-72 -translate-x-full",
                    isMobileOpen && "translate-x-0"
                )}
            >
                {/* Header */}
                <div className={cn(
                    "flex h-16 items-center border-b border-sidebar-border px-4",
                    isCollapsed && "justify-center px-2"
                )}>
                    <Link href="/dashboard" className="flex items-center gap-3 group">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-pink text-white text-xs font-bold shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all duration-300 group-hover:scale-105 shrink-0">
                            VS
                        </div>
                        {!isCollapsed && (
                            <span className="font-bold tracking-tight text-sidebar-foreground">
                                Vanda Studio
                            </span>
                        )}
                    </Link>

                    {/* Mobile close button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto md:hidden"
                        onClick={closeMobile}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-1 p-3">
                    <SidebarItem
                        href="/dashboard"
                        icon={LayoutDashboard}
                        label="Dashboard"
                    />
                    <SidebarItem
                        href="/dashboard/settings"
                        icon={Settings}
                        label="Configuracoes"
                    />
                </nav>

                {/* Footer */}
                <div className={cn(
                    "flex items-center gap-3 border-t border-sidebar-border p-3",
                    isCollapsed && "flex-col gap-2"
                )}>
                    {/* User button */}
                    <UserButton
                        appearance={{
                            elements: {
                                avatarBox: "h-9 w-9 ring-2 ring-primary/30 hover:ring-primary transition-all duration-300",
                                userButtonTrigger: "focus:shadow-none focus-visible:outline-none p-0",
                                userButtonPopoverCard: "bg-popover/95 backdrop-blur-xl border border-border/50 shadow-xl",
                                userButtonPopoverActionButton: "hover:bg-accent/50",
                                userButtonPopoverActionButtonText: "text-foreground",
                                userButtonPopoverFooter: "hidden",
                            },
                        }}
                    />

                    {/* Collapse toggle - desktop only */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggle}
                        className={cn(
                            "hidden md:flex h-9 w-9 shrink-0",
                            isCollapsed ? "mx-auto" : "ml-auto"
                        )}
                        title={isCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
                    >
                        {isCollapsed ? (
                            <PanelLeftOpen className="h-4 w-4" />
                        ) : (
                            <PanelLeftClose className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </aside>
        </>
    );
}

export function MobileMenuButton() {
    const { openMobile } = useSidebar();

    return (
        <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={openMobile}
        >
            <Menu className="h-5 w-5" />
        </Button>
    );
}
