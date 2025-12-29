"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Sidebar, SidebarProvider, MobileMenuButton, PostTabsProvider } from "@/components/sidebar";

// Hook to sync Clerk user to Convex database
function useStoreUser() {
    const { user, isLoaded } = useUser();
    const storeUser = useMutation(api.users.store);

    useEffect(() => {
        if (!isLoaded || !user) return;

        // Store user in Convex
        storeUser({
            name: user.fullName ?? user.firstName ?? "User",
            email: user.primaryEmailAddress?.emailAddress ?? "",
            imageUrl: user.imageUrl,
        }).catch((error) => {
            // Ignore errors - user might already exist
            console.log("User sync:", error.message);
        });
    }, [isLoaded, user, storeUser]);
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Sync user to Convex on dashboard load
    useStoreUser();

    return (
        <SidebarProvider>
            <PostTabsProvider>
            <div className="flex min-h-screen bg-background text-foreground relative">
                {/* Sidebar */}
                <Sidebar />

                {/* Main content area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Mobile header with menu button */}
                    <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border bg-background px-4 md:hidden">
                        <MobileMenuButton />
                        <span className="text-xs font-medium tracking-tight">Vanda Studio</span>
                    </header>

                    {/* Page content */}
                    <main className="flex-1 p-4 md:p-6">
                        {children}
                    </main>
                </div>
            </div>
            </PostTabsProvider>
        </SidebarProvider>
    );
}
