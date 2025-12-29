"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
    ShoppingBag01Icon,
    BookOpen01Icon,
    Comment01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { PostType } from "@/convex/ai/prompts";

interface PostTypeSelectorProps {
    value: PostType | null;
    onChange: (value: PostType) => void;
}

const POST_TYPES: {
    value: PostType;
    label: string;
    description: string;
    icon: typeof ShoppingBag01Icon;
}[] = [
    {
        value: "promocao",
        label: "Promocao",
        description: "Vendas, ofertas e conversao",
        icon: ShoppingBag01Icon,
    },
    {
        value: "conteudo_profissional",
        label: "Conteudo Profissional",
        description: "Autoridade e expertise",
        icon: BookOpen01Icon,
    },
    {
        value: "engajamento",
        label: "Engajamento",
        description: "Conexao e interacao",
        icon: Comment01Icon,
    },
];

export function PostTypeSelector({ value, onChange }: PostTypeSelectorProps) {
    return (
        <div className="space-y-3">
            <label className="text-sm font-medium">Tipo de Post</label>
            <div className="grid gap-3">
                {POST_TYPES.map((type) => {
                    const isSelected = value === type.value;
                    return (
                        <button
                            key={type.value}
                            type="button"
                            onClick={() => onChange(type.value)}
                            className={cn(
                                "flex items-center gap-4 p-4 rounded-none border text-left transition-all",
                                isSelected
                                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                            )}
                        >
                            <div
                                className={cn(
                                    "flex h-10 w-10 items-center justify-center rounded-none",
                                    isSelected
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted"
                                )}
                            >
                                <HugeiconsIcon icon={type.icon} className="size-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium">{type.label}</p>
                                <p className="text-xs text-muted-foreground">
                                    {type.description}
                                </p>
                            </div>
                            {isSelected && (
                                <div className="h-2 w-2 rounded-full bg-primary" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
