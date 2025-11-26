"use client";

import { Sidebar, SidebarProvider, MobileMenuButton } from "@/components/sidebar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SidebarProvider>
            <div className="flex min-h-screen bg-background text-foreground relative">
                {/* Background effects */}
                <div className="fixed inset-0 -z-10 overflow-hidden">
                    <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[radial-gradient(ellipse_at_center,var(--glow-purple),transparent_70%)] opacity-30 blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[radial-gradient(circle_at_center,var(--glow-pink),transparent_70%)] opacity-20 blur-3xl" />
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--gradient-start)_1px,transparent_1px),linear-gradient(to_bottom,var(--gradient-start)_1px,transparent_1px)] bg-[size:64px_64px] opacity-[0.02]" />
                </div>

                {/* Sidebar */}
                <Sidebar />

                {/* Main content area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Mobile header with menu button */}
                    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border/50 bg-background/80 backdrop-blur-xl px-4 md:hidden">
                        <MobileMenuButton />
                        <span className="font-bold tracking-tight">Vanda Studio</span>
                    </header>

                    {/* Page content */}
                    <main className="flex-1 p-4 md:p-6 lg:p-8">
                        {children}
                    </main>
                </div>
            </div>
        </SidebarProvider>
    );
}
