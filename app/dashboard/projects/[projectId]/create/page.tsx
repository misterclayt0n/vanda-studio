"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    ArrowLeft01Icon,
    Loading03Icon,
    SparklesIcon,
    Tick01Icon,
    Camera01Icon,
    PaintBrush01Icon,
    Minimize01Icon,
    PaintBoardIcon,
    RefreshIcon,
    Image01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { PostType } from "@/convex/ai/prompts";

import {
    PostTypeSelector,
    PillarSelector,
    ToneSelector,
    CaptionOptions,
    CreativeAnglesDisplay,
} from "@/components/brief-builder";

interface CreativeAngle {
    id: string;
    hook: string;
    approach: string;
    whyItWorks: string;
    exampleOpener: string;
}

export default function CreatePostPage() {
    const params = useParams<{ projectId: string }>();
    const router = useRouter();
    const projectId = (params?.projectId || "") as Id<"projects">;

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
    const [generatedCaption, setGeneratedCaption] = useState<string | null>(null);
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Queries
    const project = useQuery(api.projects.get, projectId ? { projectId } : "skip");
    const brandAnalysis = useQuery(api.ai.analysisMutations.getLatestAnalysis, projectId ? { projectId } : "skip");

    // Actions
    const brainstormAngles = useAction(api.ai.creativeAngles.brainstormAngles);
    const generateWithBrief = useAction(api.ai.enhancedPostGeneration.generateWithBrief);

    // Derived data
    const contentPillars = brandAnalysis?.contentPillars ?? [];
    const brandTones = brandAnalysis?.brandVoice?.tone ?? [];
    const isReady = brandAnalysis?.status === "completed";

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

    // Generate the post
    const handleGenerate = async () => {
        if (!postType || !selectedAngle) return;

        setIsGenerating(true);
        setError(null);

        try {
            const result = await generateWithBrief({
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

            // Redirect to the project page after success
            router.push(`/dashboard/projects/${projectId}?tab=generated`);
        } catch (err) {
            console.error("Failed to generate post:", err);
            setError(err instanceof Error ? err.message : "Erro ao gerar post");
        } finally {
            setIsGenerating(false);
        }
    };

    // Loading state
    if (project === undefined || brandAnalysis === undefined) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <HugeiconsIcon icon={Loading03Icon} className="size-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Project not found
    if (!project) {
        return (
            <div className="space-y-4">
                <p className="text-muted-foreground">Projeto nao encontrado.</p>
                <Button onClick={() => router.push("/dashboard")}>
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="mr-2 size-4" />
                    Voltar
                </Button>
            </div>
        );
    }

    // Brand analysis required
    if (!isReady) {
        return (
            <div className="space-y-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="mr-2 size-4" />
                    Voltar
                </Button>
                <div className="rounded-none border bg-card p-8 text-center">
                    <p className="text-lg font-medium mb-2">Analise de Marca Necessaria</p>
                    <p className="text-muted-foreground mb-4">
                        Execute a analise de marca na aba Estrategia antes de criar posts.
                    </p>
                    <Button onClick={() => router.push(`/dashboard/projects/${projectId}`)}>
                        Ir para o Projeto
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.back()}>
                        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                    </Button>
                    <div>
                        <h1 className="text-lg font-semibold">Criar Novo Post</h1>
                        <p className="text-sm text-muted-foreground">{project.name}</p>
                    </div>
                </div>
                <Button
                    onClick={handleGenerate}
                    disabled={!selectedAngle || isGenerating}
                    className="gap-2"
                >
                    {isGenerating ? (
                        <>
                            <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
                            Gerando...
                        </>
                    ) : (
                        <>
                            <HugeiconsIcon icon={SparklesIcon} className="size-4" />
                            Gerar Post
                        </>
                    )}
                </Button>
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 rounded-none bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                    {error}
                </div>
            )}

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Brief Builder */}
                <div className="space-y-6">
                    <div className="rounded-none border bg-card p-6 space-y-6">
                        <h2 className="font-medium">Brief do Post</h2>

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

                        {/* Generate Angles Button */}
                        <Button
                            onClick={handleGenerateAngles}
                            disabled={!postType || isLoadingAngles}
                            className="w-full gap-2"
                            variant="outline"
                        >
                            {isLoadingAngles ? (
                                <>
                                    <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
                                    Gerando angulos...
                                </>
                            ) : angles ? (
                                <>
                                    <HugeiconsIcon icon={RefreshIcon} className="size-4" />
                                    Gerar Novos Angulos
                                </>
                            ) : (
                                <>
                                    <HugeiconsIcon icon={SparklesIcon} className="size-4" />
                                    Gerar Angulos Criativos
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Caption Options */}
                    <div className="rounded-none border bg-card p-6 space-y-4">
                        <h2 className="font-medium">Opcoes da Legenda</h2>
                        <CaptionOptions
                            captionLength={captionLength}
                            includeHashtags={includeHashtags}
                            onLengthChange={setCaptionLength}
                            onHashtagsChange={setIncludeHashtags}
                        />
                    </div>

                    {/* Image Style */}
                    <div className="rounded-none border bg-card p-6 space-y-4">
                        <h2 className="font-medium">Estilo da Imagem</h2>
                        <div className="grid grid-cols-2 gap-3">
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
                </div>

                {/* Right Column - Angles & Preview */}
                <div className="space-y-6">
                    {/* Creative Angles */}
                    <div className="rounded-none border bg-card p-6">
                        <CreativeAnglesDisplay
                            angles={angles}
                            selectedAngle={selectedAngle}
                            isLoading={isLoadingAngles}
                            onSelectAngle={setSelectedAngle}
                            onRefresh={handleGenerateAngles}
                            cached={anglesCached}
                        />
                    </div>

                    {/* Preview Placeholder */}
                    <div className="rounded-none border bg-card p-6">
                        <h2 className="font-medium mb-4">Preview</h2>
                        {selectedAngle ? (
                            <div className="space-y-4">
                                {/* Mock Instagram Post Preview */}
                                <div className="aspect-square rounded-none bg-muted/50 border flex items-center justify-center">
                                    <div className="text-center text-muted-foreground">
                                        <HugeiconsIcon icon={Image01Icon} className="size-12 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Imagem sera gerada</p>
                                        <p className="text-xs">Estilo: {imageStyle}</p>
                                    </div>
                                </div>

                                {/* Caption Preview */}
                                <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                                        Legenda prevista
                                    </p>
                                    <div className="p-3 rounded-none bg-muted/30 border">
                                        <p className="text-sm italic text-muted-foreground">
                                            &quot;{selectedAngle.exampleOpener}&quot;
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            Abordagem: {selectedAngle.approach}
                                        </p>
                                    </div>
                                </div>

                                {/* Summary */}
                                <div className="p-3 rounded-none bg-primary/5 border border-primary/20">
                                    <p className="text-xs font-medium text-primary mb-1">Angulo selecionado</p>
                                    <p className="text-sm">{selectedAngle.hook}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="aspect-[4/5] rounded-none bg-muted/30 border border-dashed flex items-center justify-center">
                                <div className="text-center text-muted-foreground p-4">
                                    <HugeiconsIcon icon={SparklesIcon} className="size-10 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm font-medium">Selecione um angulo criativo</p>
                                    <p className="text-xs mt-1">
                                        Gere angulos a partir do brief para ver o preview
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
