"use client";

import { useTheme } from "next-themes";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Settings01Icon,
    Sun01Icon,
    Moon01Icon,
    ComputerIcon,
} from "@hugeicons/core-free-icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
    const { theme, setTheme } = useTheme();

    const themeOptions = [
        {
            value: "light",
            label: "Claro",
            icon: Sun01Icon,
            description: "Tema claro para uso diurno",
        },
        {
            value: "dark",
            label: "Escuro",
            icon: Moon01Icon,
            description: "Tema escuro para reduzir cansaco visual",
        },
        {
            value: "system",
            label: "Sistema",
            icon: ComputerIcon,
            description: "Segue a preferencia do seu sistema",
        },
    ];

    return (
        <div className="space-y-6">
            <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} className="size-5 text-primary" />
                    <h1 className="text-lg font-medium tracking-tight">Configuracoes</h1>
                </div>
                <p className="text-xs text-muted-foreground">
                    Personalize sua experiencia no Vanda Studio.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Aparencia</CardTitle>
                    <CardDescription className="text-xs">
                        Escolha como o Vanda Studio deve aparecer para voce.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Tema
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {themeOptions.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setTheme(option.value)}
                                    className={cn(
                                        "flex items-start gap-3 p-3 rounded-none border text-left transition-all",
                                        theme === option.value
                                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-none",
                                            theme === option.value
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted text-muted-foreground"
                                        )}
                                    >
                                        <HugeiconsIcon icon={option.icon} strokeWidth={2} className="size-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">{option.label}</p>
                                        <p className="text-[10px] text-muted-foreground line-clamp-2">
                                            {option.description}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
