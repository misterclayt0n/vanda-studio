"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { DashboardSquare01Icon, Settings01Icon, LeftToRightListBulletIcon, RightToLeftListBulletIcon, Menu01Icon, Cancel01Icon, CoinsSwapIcon } from "@hugeicons/core-free-icons";
import { useSidebar } from "./sidebar-context";
import { usePostTabs } from "./post-tabs-context";
import { SidebarItem } from "./sidebar-item";
import { PostTabItem } from "./post-tab-item";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";

export function Sidebar() {
    const { isCollapsed, isMobileOpen, toggle, closeMobile } = useSidebar();
    const { openTabs, setActivePost } = usePostTabs();
    const params = useParams<{ projectId?: string }>();

    // Get current project ID from URL
    const currentProjectId = params?.projectId as Id<"projects"> | undefined;

    // Get user quota
    const quota = useQuery(api.billing.usage.checkQuota, {});

    // Filter tabs for current project
    const projectTabs = currentProjectId
        ? openTabs.filter((tab) => tab.projectId === currentProjectId)
        : [];

    return (
        <>
            {/* Mobile overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-background/80 supports-[backdrop-filter]:backdrop-blur-xs md:hidden"
                    onClick={closeMobile}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 ease-in-out",
                    // Desktop - sticky with fixed height
                    "md:sticky md:top-0 md:h-screen md:translate-x-0",
                    isCollapsed ? "md:w-14" : "md:w-56",
                    // Mobile - fixed overlay
                    "w-64 -translate-x-full",
                    isMobileOpen && "translate-x-0"
                )}
            >
                {/* Header */}
                <div className={cn(
                    "flex h-12 items-center border-b border-sidebar-border px-3",
                    isCollapsed && "justify-center px-2"
                )}>
                    <Link href="/dashboard" className="flex items-center gap-2.5 group">
                        <div className="flex h-7 w-7 items-center justify-center rounded-none bg-primary text-primary-foreground text-xs font-medium shrink-0">
                            VS
                        </div>
                        {!isCollapsed && (
                            <span className="text-xs font-medium tracking-tight text-sidebar-foreground">
                                Vanda Studio
                            </span>
                        )}
                    </Link>

                    {/* Mobile close button */}
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        className="ml-auto md:hidden"
                        onClick={closeMobile}
                    >
                        <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4" />
                    </Button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto">
                    <SidebarItem
                        href="/dashboard"
                        icon={DashboardSquare01Icon}
                        label="Dashboard"
                    />
                    <SidebarItem
                        href="/dashboard/settings"
                        icon={Settings01Icon}
                        label="Configuracoes"
                    />

                    {/* Open Post Tabs */}
                    {projectTabs.length > 0 && (
                        <div className="pt-3 mt-3 border-t border-sidebar-border">
                            {!isCollapsed && (
                                <p className="px-2 mb-2 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/50">
                                    Posts Abertos
                                </p>
                            )}
                            <div className="space-y-0.5">
                                {projectTabs.map((tab) => (
                                    <PostTabItem
                                        key={tab.postId}
                                        tab={tab}
                                        onSelect={() => setActivePost(tab.postId)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </nav>

                {/* Credits Display */}
                {quota && (
                    <div className={cn(
                        "border-t border-sidebar-border p-2",
                        isCollapsed && "flex justify-center"
                    )}>
                        {isCollapsed ? (
                            <div
                                className="flex h-7 w-7 items-center justify-center rounded-none bg-primary/10 text-primary"
                                title={`${quota.remaining} creditos restantes`}
                            >
                                <HugeiconsIcon icon={CoinsSwapIcon} strokeWidth={2} className="size-3.5" />
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-none bg-primary/10 text-primary">
                                        <HugeiconsIcon icon={CoinsSwapIcon} strokeWidth={2} className="size-3.5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-sidebar-foreground">Creditos</p>
                                        <p className="text-[10px] text-sidebar-foreground/60">
                                            {quota.remaining} restantes
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className={cn(
                    "flex items-center gap-2 border-t border-sidebar-border p-2",
                    isCollapsed && "flex-col gap-2"
                )}>
                    {/* User button */}
                    <UserButton
                        appearance={{
                            elements: {
                                avatarBox: "h-7 w-7 rounded-none",
                                userButtonTrigger: "focus:shadow-none focus-visible:outline-none p-0",
                                userButtonPopoverCard: "bg-popover rounded-none ring-1 ring-foreground/10",
                                userButtonPopoverActionButton: "hover:bg-accent rounded-none",
                                userButtonPopoverActionButtonText: "text-foreground text-xs",
                                userButtonPopoverFooter: "hidden",
                            },
                        }}
                    />

                    {/* Collapse toggle - desktop only */}
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={toggle}
                        className={cn(
                            "hidden md:flex h-7 w-7 shrink-0",
                            isCollapsed ? "mx-auto" : "ml-auto"
                        )}
                        title={isCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
                    >
                        {isCollapsed ? (
                            <HugeiconsIcon icon={RightToLeftListBulletIcon} strokeWidth={2} className="size-3.5" />
                        ) : (
                            <HugeiconsIcon icon={LeftToRightListBulletIcon} strokeWidth={2} className="size-3.5" />
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
            size="icon-xs"
            className="md:hidden"
            onClick={openMobile}
        >
            <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} className="size-4" />
        </Button>
    );
}
