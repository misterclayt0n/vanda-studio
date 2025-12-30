"use client";

import { useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    ArrowLeft01Icon,
    Loading03Icon,
    SparklesIcon,
    RefreshIcon,
    Image01Icon,
    Upload04Icon,
    Delete01Icon,
    Tick01Icon,
    Copy01Icon,
    Download01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { PostType } from "@/convex/ai/prompts";

import {
    PostTypeSelector,
    CreativeAnglesDisplay,
} from "@/components/brief-builder";

interface CreativeAngle {
    id: string;
    hook: string;
    approach: string;
    whyItWorks: string;
    exampleOpener: string;
}

interface GeneratedPost {
    id: Id<"generated_posts">;
    caption: string;
    imageUrl: string | null;
}

export default function CreatePostPage() {
    const params = useParams<{ projectId: string }>();
    const router = useRouter();
    const projectId = (params?.projectId || "") as Id<"projects">;

    // Brief state
    const [postType, setPostType] = useState<PostType | null>(null);
    const [additionalContext, setAdditionalContext] = useState("");
    
    // Image upload state
    const [uploadedImages, setUploadedImages] = useState<Array<{ id: Id<"reference_images">; url: string; filename: string }>>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Angles state
    const [angles, setAngles] = useState<CreativeAngle[] | null>(null);
    const [selectedAngle, setSelectedAngle] = useState<CreativeAngle | null>(null);
    const [isLoadingAngles, setIsLoadingAngles] = useState(false);
    const [anglesCached, setAnglesCached] = useState(false);

    // Generation state
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Queries
    const project = useQuery(api.projects.get, projectId ? { projectId } : "skip");

    // Actions
    const brainstormAngles = useAction(api.ai.creativeAngles.brainstormAngles);
    const generateWithBrief = useAction(api.ai.enhancedPostGeneration.generateWithBrief);
    
    // Mutations for image upload
    const generateUploadUrl = useMutation(api.referenceImages.generateUploadUrl);
    const saveReferenceImage = useMutation(api.referenceImages.save);
    const removeReferenceImage = useMutation(api.referenceImages.remove);

    // Handle file upload
    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        setError(null);

        try {
            for (const file of Array.from(files)) {
                if (!file.type.startsWith("image/")) continue;
                if (file.size > 10 * 1024 * 1024) {
                    setError("Imagem muito grande. Maximo 10MB.");
                    continue;
                }

                const uploadUrl = await generateUploadUrl();
                const result = await fetch(uploadUrl, {
                    method: "POST",
                    headers: { "Content-Type": file.type },
                    body: file,
                });

                if (!result.ok) throw new Error("Falha ao enviar imagem");

                const { storageId } = await result.json();
                const imageId = await saveReferenceImage({
                    projectId,
                    storageId,
                    filename: file.name,
                    mimeType: file.type,
                });

                const previewUrl = URL.createObjectURL(file);
                setUploadedImages((prev) => [...prev, { id: imageId, url: previewUrl, filename: file.name }]);
            }
        } catch (err) {
            console.error("Upload failed:", err);
            setError(err instanceof Error ? err.message : "Erro ao enviar imagem");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }, [generateUploadUrl, saveReferenceImage, projectId]);

    const handleRemoveImage = useCallback(async (imageId: Id<"reference_images">) => {
        try {
            await removeReferenceImage({ id: imageId });
            setUploadedImages((prev) => prev.filter((img) => img.id !== imageId));
        } catch (err) {
            console.error("Failed to remove image:", err);
        }
    }, [removeReferenceImage]);

    const handleGenerateAngles = useCallback(async () => {
        if (!postType) return;
        setIsLoadingAngles(true);
        setError(null);

        try {
            const result = await brainstormAngles({
                projectId,
                brief: { postType, additionalContext: additionalContext || undefined },
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
    }, [postType, projectId, additionalContext, brainstormAngles]);

    const handleGenerate = async () => {
        if (!postType || !selectedAngle) return;
        setIsGenerating(true);
        setError(null);

        try {
            const result = await generateWithBrief({
                projectId,
                brief: {
                    postType,
                    captionLength: "media",
                    includeHashtags: true,
                    additionalContext: additionalContext || undefined,
                },
                selectedAngle,
            });

            // Fetch the generated post to show in preview
            const post = await fetch(`/api/generated-post/${result.generatedPostId}`).then(r => r.json()).catch(() => null);
            
            // For now just set basic info - image will be fetched via query
            setGeneratedPost({
                id: result.generatedPostId,
                caption: "",
                imageUrl: null,
            });
        } catch (err) {
            console.error("Failed to generate post:", err);
            setError(err instanceof Error ? err.message : "Erro ao gerar post");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopyCaption = async () => {
        if (!generatedPostData?.caption) return;
        await navigator.clipboard.writeText(generatedPostData.caption);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Fetch generated post details
    const generatedPostData = useQuery(
        api.generatedPosts.get,
        generatedPost?.id ? { id: generatedPost.id } : "skip"
    );

    if (project === undefined) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-120px)]">
                <HugeiconsIcon icon={Loading03Icon} className="size-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

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

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => router.back()}>
                        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                    </Button>
                    <div>
                        <h1 className="text-lg font-semibold">Criar Novo Post</h1>
                        <p className="text-xs text-muted-foreground">{project.name}</p>
                    </div>
                </div>
                {!generatedPost ? (
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
                ) : (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => {
                            setGeneratedPost(null);
                            setSelectedAngle(null);
                        }}>
                            Criar Outro
                        </Button>
                        <Button onClick={() => router.push(`/dashboard/projects/${projectId}?tab=generated`)}>
                            Ver Todos os Posts
                        </Button>
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="p-3 rounded-none bg-destructive/10 border border-destructive/30 text-sm text-destructive mb-4">
                    {error}
                </div>
            )}

            {/* Main Content - Two Columns */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
                {/* Left Column - Brief */}
                <div className="flex flex-col gap-4 min-h-0">
                    <div className="rounded-none border bg-card p-4 space-y-4 shrink-0">
                        {/* Post Type - Compact */}
                        <div className="space-y-2">
                            <Label className="text-xs">Tipo de Post</Label>
                            <div className="flex gap-2">
                                {(["promocao", "conteudo_profissional", "engajamento"] as PostType[]).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setPostType(type)}
                                        className={cn(
                                            "flex-1 px-3 py-2 text-xs rounded-none border transition-all",
                                            postType === type
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-border hover:border-primary/50"
                                        )}
                                    >
                                        {type === "promocao" ? "Promocao" : type === "conteudo_profissional" ? "Conteudo" : "Engajamento"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Context */}
                        <div className="space-y-1">
                            <Label className="text-xs">O que voce quer comunicar?</Label>
                            <Textarea
                                placeholder="Descreva o que voce quer no post..."
                                value={additionalContext}
                                onChange={(e) => setAdditionalContext(e.target.value)}
                                rows={2}
                                className="rounded-none text-sm"
                            />
                        </div>

                        {/* Image Upload - Compact */}
                        <div className="space-y-1">
                            <Label className="text-xs">Imagens de Referencia (opcional)</Label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={cn(
                                    "border border-dashed rounded-none p-3 text-center cursor-pointer transition-colors",
                                    isUploading ? "border-primary/50 bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                                )}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={handleFileUpload}
                                    disabled={isUploading}
                                />
                                {isUploading ? (
                                    <HugeiconsIcon icon={Loading03Icon} className="size-5 animate-spin text-primary mx-auto" />
                                ) : (
                                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                        <HugeiconsIcon icon={Upload04Icon} className="size-4" />
                                        Enviar imagens
                                    </div>
                                )}
                            </div>
                            {uploadedImages.length > 0 && (
                                <div className="flex gap-1 mt-2">
                                    {uploadedImages.map((img) => (
                                        <div key={img.id} className="relative group size-12">
                                            <img src={img.url} alt="" className="w-full h-full object-cover rounded-none border" />
                                            <button
                                                onClick={() => handleRemoveImage(img.id)}
                                                className="absolute -top-1 -right-1 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100"
                                            >
                                                <HugeiconsIcon icon={Delete01Icon} className="size-2.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Generate Button */}
                        <Button
                            onClick={handleGenerateAngles}
                            disabled={!postType || isLoadingAngles}
                            className="w-full gap-2"
                            variant="outline"
                            size="sm"
                        >
                            {isLoadingAngles ? (
                                <>
                                    <HugeiconsIcon icon={Loading03Icon} className="size-3 animate-spin" />
                                    Gerando...
                                </>
                            ) : (
                                <>
                                    <HugeiconsIcon icon={SparklesIcon} className="size-3" />
                                    {angles ? "Novos Angulos" : "Gerar Angulos"}
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Angles - Stretches to fill remaining space */}
                    <div className="rounded-none border bg-card p-4 flex-1 min-h-0 overflow-y-auto flex flex-col">
                        <CreativeAnglesDisplay
                            angles={angles}
                            selectedAngle={selectedAngle}
                            isLoading={isLoadingAngles}
                            onSelectAngle={setSelectedAngle}
                            onRefresh={handleGenerateAngles}
                            cached={anglesCached}
                        />
                    </div>
                </div>

                {/* Right Column - Preview/Result */}
                <div className="rounded-none border bg-card p-4 flex flex-col min-h-0">
                    <h2 className="font-medium text-sm mb-3">
                        {generatedPost ? "Post Gerado" : "Preview"}
                    </h2>
                    
                    {isGenerating ? (
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <HugeiconsIcon icon={Loading03Icon} className="size-10 animate-spin text-primary mb-3" />
                            <p className="text-sm text-muted-foreground">Gerando post...</p>
                            <p className="text-xs text-muted-foreground mt-1">Isso pode levar ate 30s</p>
                        </div>
                    ) : generatedPost && generatedPostData ? (
                        <div className="flex-1 flex flex-col min-h-0">
                            {/* Generated Image */}
                            <div className="aspect-square rounded-none bg-muted/50 border mb-3 overflow-hidden">
                                {generatedPostData.imageUrl ? (
                                    <img
                                        src={generatedPostData.imageUrl}
                                        alt="Generated"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                        <HugeiconsIcon icon={Image01Icon} className="size-8 opacity-30" />
                                    </div>
                                )}
                            </div>
                            
                            {/* Caption */}
                            <div className="flex-1 min-h-0 overflow-y-auto">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs text-muted-foreground">Legenda</p>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2"
                                            onClick={handleCopyCaption}
                                        >
                                            <HugeiconsIcon icon={copied ? Tick01Icon : Copy01Icon} className="size-3" />
                                        </Button>
                                        {generatedPostData.imageUrl && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2"
                                                asChild
                                            >
                                                <a href={generatedPostData.imageUrl} download>
                                                    <HugeiconsIcon icon={Download01Icon} className="size-3" />
                                                </a>
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <p className="text-sm whitespace-pre-wrap">{generatedPostData.caption}</p>
                            </div>
                        </div>
                    ) : selectedAngle ? (
                        <div className="flex-1 flex flex-col">
                            <div className="aspect-square rounded-none bg-muted/30 border border-dashed flex items-center justify-center mb-3">
                                <div className="text-center text-muted-foreground">
                                    <HugeiconsIcon icon={Image01Icon} className="size-8 mx-auto mb-1 opacity-30" />
                                    <p className="text-xs">Imagem sera gerada</p>
                                </div>
                            </div>
                            <div className="p-2 rounded-none bg-muted/30 border">
                                <p className="text-xs text-muted-foreground mb-1">Angulo selecionado:</p>
                                <p className="text-sm font-medium">{selectedAngle.hook}</p>
                                <p className="text-xs text-muted-foreground mt-1 italic">"{selectedAngle.exampleOpener}"</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center text-muted-foreground">
                                <HugeiconsIcon icon={SparklesIcon} className="size-8 mx-auto mb-2 opacity-30" />
                                <p className="text-xs">Selecione um angulo criativo</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
