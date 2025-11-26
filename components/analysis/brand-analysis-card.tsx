"use client";

import { Doc } from "@/convex/_generated/dataModel";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    MessageSquare,
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
        <Accordion
            type="multiple"
            defaultValue={["score", "voice"]}
            className="space-y-3"
        >
            {/* Overall Score & Summary */}
            <AccordionItem value="score">
                <AccordionTrigger>
                    <div className="flex items-center gap-3 flex-1">
                        <div className="h-10 w-10 rounded-lg bg-gradient-pink flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                            <TrendingUp className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                            <div className="font-semibold">Pontuacao Geral</div>
                            <div className="text-xs text-muted-foreground">Avaliacao da presenca digital</div>
                        </div>
                        <div className="text-2xl font-bold text-primary mr-2">
                            {analysis.overallScore ?? 0}
                            <span className="text-sm text-muted-foreground">/100</span>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <p className="text-muted-foreground leading-relaxed">
                        {analysis.strategySummary}
                    </p>
                </AccordionContent>
            </AccordionItem>

            {/* Brand Voice */}
            {analysis.brandVoice && (
                <AccordionItem value="voice">
                    <AccordionTrigger>
                        <div className="flex items-center gap-3 flex-1">
                            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                <MessageSquare className="h-5 w-5 text-blue-500" />
                            </div>
                            <div className="text-left">
                                <div className="font-semibold">Voz da Marca</div>
                                <div className="text-xs text-muted-foreground">Tom e linguagem da comunicacao</div>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
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
                    </AccordionContent>
                </AccordionItem>
            )}

            {/* Content Pillars */}
            {analysis.contentPillars && analysis.contentPillars.length > 0 && (
                <AccordionItem value="pillars">
                    <AccordionTrigger>
                        <div className="flex items-center gap-3 flex-1">
                            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                                <Lightbulb className="h-5 w-5 text-green-500" />
                            </div>
                            <div className="text-left">
                                <div className="font-semibold">Pilares de Conteudo</div>
                                <div className="text-xs text-muted-foreground">
                                    {analysis.contentPillars.length} temas principais
                                </div>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {analysis.contentPillars.map((pillar, idx) => (
                                <div
                                    key={idx}
                                    className="rounded-lg border border-border/50 p-3 space-y-2 hover:border-primary/30 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                        <h4 className="font-semibold text-sm">{pillar.name}</h4>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{pillar.description}</p>
                                    <p className="text-xs text-muted-foreground/70 italic">
                                        {pillar.reasoning}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            )}

            {/* Visual Direction */}
            {analysis.visualDirection && (
                <AccordionItem value="visual">
                    <AccordionTrigger>
                        <div className="flex items-center gap-3 flex-1">
                            <div className="h-10 w-10 rounded-lg bg-pink-500/10 flex items-center justify-center shrink-0">
                                <Palette className="h-5 w-5 text-pink-500" />
                            </div>
                            <div className="text-left">
                                <div className="font-semibold">Direcao Visual</div>
                                <div className="text-xs text-muted-foreground">Estilo e estetica do conteudo</div>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
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
                    </AccordionContent>
                </AccordionItem>
            )}

            {/* Target Audience */}
            {analysis.targetAudience && (
                <AccordionItem value="audience">
                    <AccordionTrigger>
                        <div className="flex items-center gap-3 flex-1">
                            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                                <Users className="h-5 w-5 text-purple-500" />
                            </div>
                            <div className="text-left">
                                <div className="font-semibold">Publico-Alvo</div>
                                <div className="text-xs text-muted-foreground">Quem voce deve alcancar</div>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                        <DiffBlock
                            label="Publico Atual"
                            content={analysis.targetAudience.current}
                            variant="current"
                        />
                        <DiffBlock
                            label="Publico Recomendado"
                            content={analysis.targetAudience.recommended}
                            variant="recommended"
                        />
                        <ReasoningBlock reasoning={analysis.targetAudience.reasoning} />
                    </AccordionContent>
                </AccordionItem>
            )}
        </Accordion>
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
            className={`rounded-lg p-3 border ${
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
        <div className="flex items-start gap-2 pt-1">
            <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground italic">{reasoning}</p>
        </div>
    );
}
