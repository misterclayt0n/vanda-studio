"use client";

import { Doc } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    MessageSquare,
    Target,
    Palette,
    Users,
    TrendingUp,
    Lightbulb,
    ArrowRight,
    CheckCircle2,
} from "lucide-react";

interface BrandAnalysisCardProps {
    analysis: Doc<"brand_analysis">;
}

export function BrandAnalysisCard({ analysis }: BrandAnalysisCardProps) {
    if (analysis.status !== "completed") {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Overall Score & Summary */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-xl bg-gradient-purple flex items-center justify-center shadow-lg shadow-primary/20">
                                <TrendingUp className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <CardTitle>Pontuação Geral</CardTitle>
                                <CardDescription>Avaliação da presença digital</CardDescription>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-4xl font-bold text-primary">
                                {analysis.overallScore ?? 0}
                                <span className="text-lg text-muted-foreground">/100</span>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground leading-relaxed">
                        {analysis.strategySummary}
                    </p>
                </CardContent>
            </Card>

            {/* Brand Voice */}
            {analysis.brandVoice && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <MessageSquare className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                                <CardTitle>Voz da Marca</CardTitle>
                                <CardDescription>Tom e linguagem da comunicação</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <DiffBlock
                            label="Atual"
                            content={analysis.brandVoice.current}
                            variant="current"
                        />
                        <DiffBlock
                            label="Recomendado"
                            content={analysis.brandVoice.recommended}
                            variant="recommended"
                        />
                        <ReasoningBlock reasoning={analysis.brandVoice.reasoning} />

                        {analysis.brandVoice.tone.length > 0 && (
                            <div className="pt-2">
                                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                                    Tons Sugeridos
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.brandVoice.tone.map((tone, idx) => (
                                        <span
                                            key={idx}
                                            className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium"
                                        >
                                            {tone}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Content Pillars */}
            {analysis.contentPillars && analysis.contentPillars.length > 0 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                <Lightbulb className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                                <CardTitle>Pilares de Conteúdo</CardTitle>
                                <CardDescription>Temas principais para sua estratégia</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            {analysis.contentPillars.map((pillar, idx) => (
                                <div
                                    key={idx}
                                    className="rounded-lg border border-border/50 p-4 space-y-2 hover:border-primary/30 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        <h4 className="font-semibold">{pillar.name}</h4>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{pillar.description}</p>
                                    <p className="text-xs text-muted-foreground/70 italic">
                                        {pillar.reasoning}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Visual Direction */}
            {analysis.visualDirection && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                                <Palette className="h-5 w-5 text-pink-500" />
                            </div>
                            <div>
                                <CardTitle>Direção Visual</CardTitle>
                                <CardDescription>Estilo e estética do conteúdo</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <DiffBlock
                            label="Estilo Atual"
                            content={analysis.visualDirection.currentStyle}
                            variant="current"
                        />
                        <DiffBlock
                            label="Estilo Recomendado"
                            content={analysis.visualDirection.recommendedStyle}
                            variant="recommended"
                        />
                        <ReasoningBlock reasoning={analysis.visualDirection.reasoning} />
                    </CardContent>
                </Card>
            )}

            {/* Target Audience */}
            {analysis.targetAudience && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                <Users className="h-5 w-5 text-purple-500" />
                            </div>
                            <div>
                                <CardTitle>Público-Alvo</CardTitle>
                                <CardDescription>Quem você deve alcançar</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <DiffBlock
                            label="Público Atual"
                            content={analysis.targetAudience.current}
                            variant="current"
                        />
                        <DiffBlock
                            label="Público Recomendado"
                            content={analysis.targetAudience.recommended}
                            variant="recommended"
                        />
                        <ReasoningBlock reasoning={analysis.targetAudience.reasoning} />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function DiffBlock({
    label,
    content,
    variant,
}: {
    label: string;
    content: string;
    variant: "current" | "recommended";
}) {
    const isCurrent = variant === "current";

    return (
        <div
            className={`rounded-lg p-4 border ${
                isCurrent
                    ? "bg-red-500/5 border-red-500/20"
                    : "bg-green-500/5 border-green-500/20"
            }`}
        >
            <div className="flex items-center gap-2 mb-2">
                <div
                    className={`h-2 w-2 rounded-full ${
                        isCurrent ? "bg-red-500" : "bg-green-500"
                    }`}
                />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {label}
                </span>
            </div>
            <p className="text-sm leading-relaxed">{content}</p>
        </div>
    );
}

function ReasoningBlock({ reasoning }: { reasoning: string }) {
    return (
        <div className="flex items-start gap-2 pt-2">
            <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground italic">{reasoning}</p>
        </div>
    );
}
