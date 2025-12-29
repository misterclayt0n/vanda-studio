"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface CaptionOptionsProps {
    captionLength: "curta" | "media" | "longa";
    includeHashtags: boolean;
    onLengthChange: (length: "curta" | "media" | "longa") => void;
    onHashtagsChange: (include: boolean) => void;
}

const LENGTH_OPTIONS: {
    value: "curta" | "media" | "longa";
    label: string;
    description: string;
}[] = [
    { value: "curta", label: "Curta", description: "50-100 caracteres" },
    { value: "media", label: "Media", description: "100-200 caracteres" },
    { value: "longa", label: "Longa", description: "200-350 caracteres" },
];

export function CaptionOptions({
    captionLength,
    includeHashtags,
    onLengthChange,
    onHashtagsChange,
}: CaptionOptionsProps) {
    return (
        <div className="space-y-4">
            {/* Caption Length */}
            <div className="space-y-3">
                <Label>Tamanho da Legenda</Label>
                <div className="flex gap-2">
                    {LENGTH_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => onLengthChange(option.value)}
                            className={cn(
                                "flex-1 px-3 py-2 rounded-none border text-center transition-all",
                                captionLength === option.value
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                            )}
                        >
                            <p className="text-sm font-medium">{option.label}</p>
                            <p className="text-[10px] text-muted-foreground">
                                {option.description}
                            </p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Hashtags Toggle */}
            <div className="flex items-center justify-between p-3 rounded-none border bg-muted/30">
                <div>
                    <Label htmlFor="hashtags-toggle" className="cursor-pointer">
                        Incluir Hashtags
                    </Label>
                    <p className="text-xs text-muted-foreground">
                        Adiciona 5-10 hashtags relevantes no final
                    </p>
                </div>
                <Switch
                    id="hashtags-toggle"
                    checked={includeHashtags}
                    onCheckedChange={onHashtagsChange}
                />
            </div>
        </div>
    );
}
