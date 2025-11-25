import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-14 items-center justify-between px-4">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="flex items-center gap-2 font-bold">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                                VS
                            </div>
                            <span className="hidden sm:inline-block">Vanda Studio</span>
                        </Link>
                        <nav className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
                            <Link href="/dashboard" className="transition-colors hover:text-foreground">
                                Dashboard
                            </Link>
                            <Link href="/dashboard/settings" className="transition-colors hover:text-foreground">
                                Configurações
                            </Link>
                        </nav>
                    </div>
                    <div className="flex items-center gap-3">
                        <ModeToggle />
                        <UserButton
                            appearance={{
                                elements: {
                                    avatarBox: "h-8 w-8 ring-2 ring-border hover:ring-primary transition-all",
                                    userButtonTrigger: "focus:shadow-none focus-visible:outline-none p-0",
                                    userButtonPopoverCard: "bg-popover border border-border shadow-lg",
                                    userButtonPopoverActionButton: "hover:bg-muted",
                                    userButtonPopoverActionButtonText: "text-foreground",
                                    userButtonPopoverFooter: "hidden",
                                },
                            }}
                        />
                    </div>
                </div>
            </header>
            <main className="flex-1 container mx-auto p-4 md:p-8">
                {children}
            </main>
        </div>
    );
}
