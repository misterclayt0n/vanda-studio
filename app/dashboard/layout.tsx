import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";
import { LayoutDashboard, Settings, Sparkles } from "lucide-react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground relative overflow-hidden">
            {/* Background effects */}
            <div className="fixed inset-0 -z-10">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[radial-gradient(ellipse_at_center,var(--glow-purple),transparent_70%)] opacity-30 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[radial-gradient(circle_at_center,var(--glow-pink),transparent_70%)] opacity-20 blur-3xl" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--gradient-start)_1px,transparent_1px),linear-gradient(to_bottom,var(--gradient-start)_1px,transparent_1px)] bg-[size:64px_64px] opacity-[0.02]" />
            </div>

            <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
                <div className="container flex h-16 items-center justify-between px-4">
                    <div className="flex items-center gap-6">
                        <Link href="/dashboard" className="flex items-center gap-3 group">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-purple text-white text-xs font-bold shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all duration-300 group-hover:scale-105">
                                VS
                            </div>
                            <span className="hidden sm:inline-block font-bold tracking-tight">Vanda Studio</span>
                        </Link>
                        <nav className="flex items-center gap-1">
                            <Link
                                href="/dashboard"
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
                            >
                                <LayoutDashboard className="h-4 w-4" />
                                <span className="hidden sm:inline">Dashboard</span>
                            </Link>
                            <Link
                                href="/dashboard/settings"
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
                            >
                                <Settings className="h-4 w-4" />
                                <span className="hidden sm:inline">Configurações</span>
                            </Link>
                        </nav>
                    </div>
                    <div className="flex items-center gap-2">
                        <ModeToggle />
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
                    </div>
                </div>
            </header>
            <main className="flex-1 container mx-auto p-4 md:p-8 relative z-10">
                {children}
            </main>
        </div>
    );
}
