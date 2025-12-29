"use client";

import { useState, useCallback } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    ArrowLeft01Icon,
    ArrowRight01Icon,
    Loading03Icon,
    SparklesIcon,
    Tick01Icon,
    Camera01Icon,
    PaintBrush01Icon,
    Minimize01Icon,
    PaintBoardIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PostType } from "@/convex/ai/prompts";

import { PostTypeSelector } from "./post-type-selector";
import { PillarSelector } from "./pillar-selector";
import { ToneSelector } from "./tone-selector";
import { CaptionOptions } from "./caption-options";
import { CreativeAnglesDisplay } from "./creative-angles-display";

interface CreativeAngle {
    id: string;
    hook: string;
    approach: string;
    whyItWorks: string;
    exampleOpener: string;
}

interface BriefBuilderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: Id<"projects">;
    onSuccess?: () => void;
}

type Step = "brief" | "angles" | "options" | "generate";

const STEPS: Step[] = ["brief", "angles", "options", "generate"];

const STEP_TITLES: Record<Step, string> = {
    brief: "Defina o Brief",
    angles: "Escolha um Angulo",
    options: "Opcoes Finais",
    generate: "Gerando Post",
};

export function BriefBuilderDialog({
    open,
    onOpenChange,
    projectId,
    onSuccess,
}: BriefBuilderDialogProps) {
    const [currentStep, setCurrentStep] = useState<Step>("brief");
    
    // Brief state
    const [postType, setPostType] = useState<PostType | null>(null);
    const [selectedPillar, setSelectedPillar] = useState<string | null>(null);
    const [customTopic, setCustomTopic] = useState("");
    const [selectedTones, setSelectedTones] = useState<string[]>([]);
    const [referenceText, setReferenceText] = useState("");
    const [additionalContext, setAdditionalContext] = useState("");
    
    // Options state
    const [captionLength, setCaptionLength] = useState<"curta" | "media" | "longa">("media");
    const [includeHashtags, setIncludeHashtags] = useState(true);
    const [imageStyle, setImageStyle] = useState<"realistic" | "illustrative" | "minimalist" | "artistic">("realistic");
    
    // Angles state
    const [angles, setAngles] = useState<CreativeAngle[] | null>(null);
    const [selectedAngle, setSelectedAngle] = useState<CreativeAngle | null>(null);
    const [isLoadingAngles, setIsLoadingAngles] = useState(false);
    const [anglesCached, setAnglesCached] = useState(false);
    
    // Generation state
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Queries
    const brandAnalysis = useQuery(api.ai.analysisMutations.getLatestAnalysis, { projectId });
    const contextStatus = useQuery(api.generatedPosts.checkContextReady, { projectId });
    
    // Actions
    const brainstormAngles = useAction(api.ai.creativeAngles.brainstormAngles);
    const generateWithBrief = useAction(api.ai.enhancedPostGeneration.generateWithBrief);

    // Derived data
    const contentPillars = brandAnalysis?.contentPillars ?? [];
    const brandTones = brandAnalysis?.brandVoice?.tone ?? [];

    // Reset state when dialog opens/closes
    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            // Reset all state
            setCurrentStep("brief");
            setPostType(null);
            setSelectedPillar(null);
            setCustomTopic("");
            setSelectedTones([]);
            setReferenceText("");
            setAdditionalContext("");
            setCaptionLength("media");
            setIncludeHashtags(true);
            setImageStyle("realistic");
            setAngles(null);
            setSelectedAngle(null);
            setError(null);
        }
        onOpenChange(newOpen);
    };

    // Navigate between steps
    const goToStep = (step: Step) => {
        setCurrentStep(step);
        setError(null);
    };

    const canProceed = (step: Step): boolean => {
        switch (step) {
            case "brief":
                return !!postType;
            case "angles":
                return !!selectedAngle;
            case "options":
                return true;
            case "generate":
                return false; // This is the final step
            default:
                return false;
        }
    };

    // Generate creative angles
    const handleGenerateAngles = useCallback(async () => {
        if (!postType) return;
        
        setIsLoadingAngles(true);
        setError(null);
        
        try {
            const result = await brainstormAngles({
                projectId,
                brief: {
                    postType,
                    contentPillar: selectedPillar ?? undefined,
                    customTopic: customTopic || undefined,
                    toneOverride: selectedTones.length > 0 ? selectedTones : undefined,
                    referenceText: referenceText || undefined,
                    additionalContext: additionalContext || undefined,
                },
            });
            
            setAngles(result.angles);
            setAnglesCached(result.cached);
            setSelectedAngle(null);
        } catch (err) {
            console.error("Failed to generate angles:", err);
            setError(err instanceof Error ? err.message : "Erro ao gerar angulos criativos");
        } finally {
            setIsLoadingAngles(false);
        }
    }, [
        postType,
        projectId,
        selectedPillar,
        customTopic,
        selectedTones,
        referenceText,
        additionalContext,
        brainstormAngles,
    ]);

    // Handle proceeding to next step
    const handleNext = async () => {
        const currentIndex = STEPS.indexOf(currentStep);
        
        if (currentStep === "brief") {
            // Before moving to angles, generate them
            await handleGenerateAngles();
            goToStep("angles");
        } else if (currentStep === "angles") {
            goToStep("options");
        } else if (currentStep === "options") {
            // Start generation
            goToStep("generate");
            await handleGenerate();
        }
    };

    const handleBack = () => {
        const currentIndex = STEPS.indexOf(currentStep);
        if (currentIndex > 0) {
            goToStep(STEPS[currentIndex - 1]);
        }
    };

    // Generate the post
    const handleGenerate = async () => {
        if (!postType || !selectedAngle) return;
        
        setIsGenerating(true);
        setError(null);
        
        try {
            await generateWithBrief({
                projectId,
                brief: {
                    postType,
                    contentPillar: selectedPillar ?? undefined,
                    customTopic: customTopic || undefined,
                    toneOverride: selectedTones.length > 0 ? selectedTones : undefined,
                    captionLength,
                    includeHashtags,
                    additionalContext: additionalContext || undefined,
                    referenceText: referenceText || undefined,
                },
                selectedAngle,
                imageStyle,
            });
            
            onSuccess?.();
            handleOpenChange(false);
        } catch (err) {
            console.error("Failed to generate post:", err);
            setError(err instanceof Error ? err.message : "Erro ao gerar post");
            goToStep("options"); // Go back to options to retry
        } finally {
            setIsGenerating(false);
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case "brief":
                return (
                    <div className="space-y-6">
                        {/* Post Type */}
                        <PostTypeSelector value={postType} onChange={setPostType} />

                        {/* Content Pillar */}
                        {contentPillars.length > 0 && (
                            <PillarSelector
                                pillars={contentPillars}
                                selectedPillar={selectedPillar}
                                customTopic={customTopic}
                                onPillarChange={setSelectedPillar}
                                onCustomTopicChange={setCustomTopic}
                            />
                        )}

                        {/* Tone Override */}
                        <ToneSelector
                            availableTones={brandTones}
                            selectedTones={selectedTones}
                            onChange={setSelectedTones}
                        />

                        {/* Reference Text */}
                        <div className="space-y-2">
                            <Label>Texto de Referencia (opcional)</Label>
                            <Textarea
                                placeholder="Cole aqui um texto, promocao, informacao de produto..."
                                value={referenceText}
                                onChange={(e) => setReferenceText(e.target.value)}
                                rows={3}
                                className="rounded-none"
                            />
                        </div>

                        {/* Additional Context */}
                        <div className="space-y-2">
                            <Label>Contexto Adicional (opcional)</Label>
                            <Textarea
                                placeholder="Informacoes extras, data comemorativa, lancamento..."
                                value={additionalContext}
                                onChange={(e) => setAdditionalContext(e.target.value)}
                                rows={2}
                                className="rounded-none"
                            />
                        </div>
                    </div>
                );

            case "angles":
                return (
                    <div className="space-y-4">
                        <CreativeAnglesDisplay
                            angles={angles}
                            selectedAngle={selectedAngle}
                            isLoading={isLoadingAngles}
                            onSelectAngle={setSelectedAngle}
                            onRefresh={handleGenerateAngles}
                            cached={anglesCached}
                        />
                    </div>
                );

            case "options":
                return (
                    <div className="space-y-6">
                        {/* Caption Options */}
                        <CaptionOptions
                            captionLength={captionLength}
                            includeHashtags={includeHashtags}
                            onLengthChange={setCaptionLength}
                            onHashtagsChange={setIncludeHashtags}
                        />

                        {/* Image Style */}
                        <div className="space-y-3">
                            <Label>Estilo da Imagem</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { value: "realistic" as const, label: "Realista", icon: Camera01Icon, desc: "Foto profissional" },
                                    { value: "illustrative" as const, label: "Ilustrativo", icon: PaintBoardIcon, desc: "Arte digital" },
                                    { value: "minimalist" as const, label: "Minimalista", icon: Minimize01Icon, desc: "Clean e simples" },
                                    { value: "artistic" as const, label: "Artistico", icon: PaintBrush01Icon, desc: "Criativo e ousado" },
                                ].map((style) => (
                                    <button
                                        key={style.value}
                                        type="button"
                                        onClick={() => setImageStyle(style.value)}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-none border text-left transition-all",
                                            imageStyle === style.value
                                                ? "border-primary bg-primary/10 ring-1 ring-primary"
                                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                                        )}
                                    >
                                        <div className={cn(
                                            "flex h-9 w-9 items-center justify-center rounded-none",
                                            imageStyle === style.value ? "bg-primary text-primary-foreground" : "bg-muted"
                                        )}>
                                            <HugeiconsIcon icon={style.icon} className="size-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{style.label}</p>
                                            <p className="text-xs text-muted-foreground">{style.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Summary */}
                        {selectedAngle && (
                            <div className="p-4 rounded-none border bg-muted/30">
                                <p className="text-xs text-muted-foreground mb-2">Angulo selecionado:</p>
                                <p className="text-sm font-medium">{selectedAngle.hook}</p>
                                <p className="text-xs text-muted-foreground mt-1">{selectedAngle.approach}</p>
                            </div>
                        )}
                    </div>
                );

            case "generate":
                return (
                    <div className="flex flex-col items-center justify-center py-12">
                        {isGenerating ? (
                            <>
                                <HugeiconsIcon
                                    icon={Loading03Icon}
                                    className="size-12 animate-spin text-primary mb-4"
                                />
                                <p className="text-lg font-medium">Gerando seu post...</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Isso pode levar ate 30 segundos
                                </p>
                            </>
                        ) : error ? (
                            <>
                                <p className="text-destructive mb-4">{error}</p>
                                <Button onClick={() => goToStep("options")}>
                                    Tentar Novamente
                                </Button>
                            </>
                        ) : (
                            <>
                                <HugeiconsIcon
                                    icon={Tick01Icon}
                                    className="size-12 text-green-500 mb-4"
                                />
                                <p className="text-lg font-medium">Post gerado com sucesso!</p>
                            </>
                        )}
                    </div>
                );
        }
    };

    // Progress indicator
    const currentStepIndex = STEPS.indexOf(currentStep);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>{STEP_TITLES[currentStep]}</DialogTitle>
                    <DialogDescription>
                        {currentStep === "brief" && "Defina o objetivo e contexto do seu post"}
                        {currentStep === "angles" && "Escolha um angulo criativo para sua legenda"}
                        {currentStep === "options" && "Ajuste as opcoes finais antes de gerar"}
                        {currentStep === "generate" && "Aguarde enquanto geramos seu post"}
                    </DialogDescription>
                </DialogHeader>

                {/* Progress */}
                {currentStep !== "generate" && (
                    <div className="flex items-center gap-1 mb-2">
                        {STEPS.slice(0, -1).map((step, index) => (
                            <div
                                key={step}
                                className={cn(
                                    "h-1 flex-1 rounded-none transition-colors",
                                    index <= currentStepIndex ? "bg-primary" : "bg-muted"
                                )}
                            />
                        ))}
                    </div>
                )}

                {/* Error display */}
                {error && currentStep !== "generate" && (
                    <div className="p-3 rounded-none bg-destructive/10 border border-destructive/30 text-sm text-destructive mb-4">
                        {error}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto py-4">
                    {renderStepContent()}
                </div>

                {/* Footer */}
                {currentStep !== "generate" && (
                    <div className="flex items-center justify-between pt-4 border-t">
                        <Button
                            variant="outline"
                            onClick={handleBack}
                            disabled={currentStepIndex === 0}
                        >
                            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4 mr-2" />
                            Voltar
                        </Button>
                        
                        <Button
                            onClick={handleNext}
                            disabled={!canProceed(currentStep) || isLoadingAngles}
                        >
                            {isLoadingAngles ? (
                                <>
                                    <HugeiconsIcon icon={Loading03Icon} className="size-4 mr-2 animate-spin" />
                                    Gerando angulos...
                                </>
                            ) : currentStep === "options" ? (
                                <>
                                    <HugeiconsIcon icon={SparklesIcon} className="size-4 mr-2" />
                                    Gerar Post
                                </>
                            ) : (
                                <>
                                    Proximo
                                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 ml-2" />
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
