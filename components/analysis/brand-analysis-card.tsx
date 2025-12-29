"use client";

import { Doc } from "@/convex/_generated/dataModel";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    CommentAdd01Icon,
    PaintBrush01Icon,
    UserMultiple02Icon,
    AnalyticsUpIcon,
    Idea01Icon,
    ArrowRight01Icon,
    CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";

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
            className="space-y-2"
        >
            {/* Overall Score & Summary */}
            <AccordionItem value="score">
                <AccordionTrigger>
                    <div className="flex items-center gap-3 flex-1">
                        <div className="h-8 w-8 rounded-none bg-primary/10 flex items-center justify-center shrink-0">
                            <HugeiconsIcon icon={AnalyticsUpIcon} strokeWidth={2} className="size-4 text-primary" />
                        </div>
                        <div className="flex-1 text-left">
                            <div className="text-xs font-medium">Pontuacao Geral</div>
                            <div className="text-[10px] text-muted-foreground">Avaliacao da presenca digital</div>
                        </div>
                        <div className="text-lg font-medium text-primary mr-2">
                            {analysis.overallScore ?? 0}
                            <span className="text-xs text-muted-foreground">/100</span>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                        {analysis.strategySummary}
                    </p>
                </AccordionContent>
            </AccordionItem>

            {/* Brand Voice */}
            {analysis.brandVoice && (
                <AccordionItem value="voice">
                    <AccordionTrigger>
                        <div className="flex items-center gap-3 flex-1">
                            <div className="h-8 w-8 rounded-none bg-[var(--info)]/10 flex items-center justify-center shrink-0">
                                <HugeiconsIcon icon={CommentAdd01Icon} strokeWidth={2} className="size-4 text-[var(--info)]" />
                            </div>
                            <div className="text-left">
                                <div className="text-xs font-medium">Voz da Marca</div>
                                <div className="text-[10px] text-muted-foreground">Tom e linguagem da comunicacao</div>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
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
                                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                                    Tons Sugeridos
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {analysis.brandVoice.tone.map((tone, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2 py-0.5 rounded-none bg-primary/10 text-primary text-xs font-medium"
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
                            <div className="h-8 w-8 rounded-none bg-[var(--success)]/10 flex items-center justify-center shrink-0">
                                <HugeiconsIcon icon={Idea01Icon} strokeWidth={2} className="size-4 text-[var(--success)]" />
                            </div>
                            <div className="text-left">
                                <div className="text-xs font-medium">Pilares de Conteudo</div>
                                <div className="text-[10px] text-muted-foreground">
                                    {analysis.contentPillars.length} temas principais
                                </div>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {analysis.contentPillars.map((pillar, idx) => (
                                <div
                                    key={idx}
                                    className="rounded-none ring-1 ring-foreground/10 p-3 space-y-2 hover:ring-primary/30 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-3.5 text-[var(--success)] shrink-0" />
                                        <h4 className="font-medium text-xs">{pillar.name}</h4>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{pillar.description}</p>
                                    <p className="text-[10px] text-muted-foreground/70 italic">
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
                            <div className="h-8 w-8 rounded-none bg-primary/10 flex items-center justify-center shrink-0">
                                <HugeiconsIcon icon={PaintBrush01Icon} strokeWidth={2} className="size-4 text-primary" />
                            </div>
                            <div className="text-left">
                                <div className="text-xs font-medium">Direcao Visual</div>
                                <div className="text-[10px] text-muted-foreground">Estilo e estetica do conteudo</div>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
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
                            <div className="h-8 w-8 rounded-none bg-primary/10 flex items-center justify-center shrink-0">
                                <HugeiconsIcon icon={UserMultiple02Icon} strokeWidth={2} className="size-4 text-primary" />
                            </div>
                            <div className="text-left">
                                <div className="text-xs font-medium">Publico-Alvo</div>
                                <div className="text-[10px] text-muted-foreground">Quem voce deve alcancar</div>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
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
            className={`rounded-none p-3 ring-1 ${
                isCurrent
                    ? "bg-destructive/5 ring-destructive/20"
                    : "bg-[var(--success)]/5 ring-[var(--success)]/20"
            }`}
        >
            <div className="flex items-center gap-2 mb-2">
                <div
                    className={`h-1.5 w-1.5 rounded-none ${
                        isCurrent ? "bg-destructive" : "bg-[var(--success)]"
                    }`}
                />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {label}
                </span>
            </div>
            <p className="text-xs leading-relaxed">{content}</p>
        </div>
    );
}

function ReasoningBlock({ reasoning }: { reasoning: string }) {
    return (
        <div className="flex items-start gap-2 pt-1">
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3.5 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground italic">{reasoning}</p>
        </div>
    );
}
