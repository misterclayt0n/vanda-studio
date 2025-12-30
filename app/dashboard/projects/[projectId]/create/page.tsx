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
    Edit01Icon,
    Cancel01Icon,
    Clock01Icon,
    ArrowTurnBackwardIcon,
    TextIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { PostType } from "@/convex/ai/prompts";

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

    // Generation state
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null);
    const [copied, setCopied] = useState(false);
    
    // Regeneration state
    const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
    const [isRegeneratingCaption, setIsRegeneratingCaption] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [showFeedbackFor, setShowFeedbackFor] = useState<"image" | "caption" | null>(null);
    
    // Caption editing state
    const [isEditingCaption, setIsEditingCaption] = useState(false);
    const [editedCaption, setEditedCaption] = useState("");
    
    // Version history state
    const [showHistory, setShowHistory] = useState(false);
    
    // Confirmation dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        type: "image" | "caption" | "both";
        credits: number;
    }>({ open: false, type: "image", credits: 1 });

    // Helper to show user-friendly error toasts
    const showErrorToast = useCallback((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        
        // Parse common error patterns and show friendly messages
        if (message.includes("Saldo insuficiente") || message.includes("creditos")) {
            toast.error("Creditos insuficientes", {
                description: "Voce precisa de mais creditos para gerar um post.",
            });
        } else if (message.includes("Not authenticated")) {
            toast.error("Sessao expirada", {
                description: "Faca login novamente para continuar.",
            });
        } else if (message.includes("Project not found")) {
            toast.error("Projeto nao encontrado", {
                description: "Este projeto pode ter sido removido.",
            });
        } else {
            toast.error("Erro", {
                description: message.length > 100 ? "Ocorreu um erro inesperado. Tente novamente." : message,
            });
        }
    }, []);

    // Queries
    const project = useQuery(api.projects.get, projectId ? { projectId } : "skip");

    // Actions
    const generatePost = useAction(api.ai.enhancedPostGeneration.generatePost);
    const regenerateImageAction = useAction(api.ai.regenerate.regenerateImage);
    const regenerateCaptionAction = useAction(api.ai.regenerate.regenerateCaption);
    
    // Mutations for image upload
    const generateUploadUrl = useMutation(api.referenceImages.generateUploadUrl);
    const saveReferenceImage = useMutation(api.referenceImages.save);
    const removeReferenceImage = useMutation(api.referenceImages.remove);
    const updateCaption = useMutation(api.generatedPosts.updateCaption);
    const restoreVersion = useMutation(api.generationHistory.restoreVersion);

    // Handle file upload
    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);

        try {
            for (const file of Array.from(files)) {
                if (!file.type.startsWith("image/")) continue;
                if (file.size > 10 * 1024 * 1024) {
                    toast.error("Imagem muito grande", { description: "Maximo 10MB por imagem." });
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
            showErrorToast(err);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }, [generateUploadUrl, saveReferenceImage, projectId, showErrorToast]);

    const handleRemoveImage = useCallback(async (imageId: Id<"reference_images">) => {
        try {
            await removeReferenceImage({ id: imageId });
            setUploadedImages((prev) => prev.filter((img) => img.id !== imageId));
        } catch (err) {
            console.error("Failed to remove image:", err);
        }
    }, [removeReferenceImage]);

    const handleGenerate = async () => {
        if (!postType) return;
        setIsGenerating(true);

        try {
            const result = await generatePost({
                projectId,
                brief: {
                    postType,
                    captionLength: "media",
                    includeHashtags: true,
                    additionalContext: additionalContext || undefined,
                },
            });

            setGeneratedPost({
                id: result.generatedPostId,
                caption: "",
                imageUrl: null,
            });
            
            toast.success("Post gerado!", {
                description: "Sua legenda e imagem estao prontas.",
            });
        } catch (err) {
            console.error("Failed to generate post:", err);
            showErrorToast(err);
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

    // Show confirmation before regeneration
    const showRegenerateConfirmation = (type: "image" | "caption" | "both") => {
        const credits = type === "both" ? 2 : 1;
        setConfirmDialog({ open: true, type, credits });
    };

    // Execute regeneration after confirmation
    const handleConfirmedRegenerate = async () => {
        const { type } = confirmDialog;
        setConfirmDialog({ ...confirmDialog, open: false });
        
        if (type === "image") {
            await executeRegenerateImage();
        } else {
            await executeRegenerateCaption(type === "both");
        }
    };

    // Regeneration handlers
    const executeRegenerateImage = async () => {
        if (!generatedPost?.id) return;
        setIsRegeneratingImage(true);
        
        try {
            await regenerateImageAction({
                generatedPostId: generatedPost.id,
                feedback: feedback.trim() || undefined,
            });
            
            toast.success("Imagem regenerada!", {
                description: "Uma nova imagem foi gerada.",
            });
            setFeedback("");
            setShowFeedbackFor(null);
        } catch (err) {
            console.error("Failed to regenerate image:", err);
            showErrorToast(err);
        } finally {
            setIsRegeneratingImage(false);
        }
    };

    const executeRegenerateCaption = async (alsoRegenerateImage = false) => {
        if (!generatedPost?.id) return;
        setIsRegeneratingCaption(true);
        
        try {
            await regenerateCaptionAction({
                generatedPostId: generatedPost.id,
                feedback: feedback.trim() || undefined,
                keepImage: !alsoRegenerateImage,
            });
            
            toast.success("Legenda regenerada!", {
                description: alsoRegenerateImage 
                    ? "Nova legenda e imagem geradas." 
                    : "Uma nova legenda foi gerada.",
            });
            setFeedback("");
            setShowFeedbackFor(null);
        } catch (err) {
            console.error("Failed to regenerate caption:", err);
            showErrorToast(err);
        } finally {
            setIsRegeneratingCaption(false);
        }
    };

    // Caption editing handlers
    const handleStartEditCaption = () => {
        if (generatedPostData?.caption) {
            setEditedCaption(generatedPostData.caption);
            setIsEditingCaption(true);
        }
    };

    const handleSaveCaption = async () => {
        if (!generatedPost?.id || !editedCaption.trim()) return;
        
        try {
            await updateCaption({
                id: generatedPost.id,
                caption: editedCaption.trim(),
            });
            
            toast.success("Legenda salva!");
            setIsEditingCaption(false);
        } catch (err) {
            console.error("Failed to save caption:", err);
            showErrorToast(err);
        }
    };

    const handleCancelEditCaption = () => {
        setIsEditingCaption(false);
        setEditedCaption("");
    };

    // Version history handlers
    const handleRestoreVersion = async (version: number) => {
        if (!generatedPost?.id) return;
        
        try {
            await restoreVersion({
                generatedPostId: generatedPost.id,
                version,
            });
            
            toast.success("Versao restaurada!", {
                description: `Versao ${version} restaurada com sucesso.`,
            });
            setShowHistory(false);
        } catch (err) {
            console.error("Failed to restore version:", err);
            showErrorToast(err);
        }
    };

    // Fetch generated post details
    const generatedPostData = useQuery(
        api.generatedPosts.get,
        generatedPost?.id ? { id: generatedPost.id } : "skip"
    );

    // Fetch generation history
    const generationHistory = useQuery(
        api.generationHistory.getHistory,
        generatedPost?.id ? { generatedPostId: generatedPost.id } : "skip"
    );

    // Check user credits
    const userQuota = useQuery(api.billing.usage.checkQuota, {});

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
                        disabled={!postType || isGenerating}
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
                        }}>
                            Criar Outro
                        </Button>
                        <Button onClick={() => router.push(`/dashboard/projects/${projectId}?tab=generated`)}>
                            Ver Todos os Posts
                        </Button>
                    </div>
                )}
            </div>

            {/* Main Content - Two Columns */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6 min-h-0">
                {/* Left Column - Brief */}
                <aside className="flex flex-col min-h-0">
                    <div className="rounded-none border bg-card flex flex-col min-h-0">
                        <div className="px-4 py-3 border-b">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Brief do post
                            </p>
                        </div>

                        {/* Post Type - Compact */}
                        <div className="p-4 border-b space-y-2">
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
                        <div className="p-4 border-b space-y-1">
                            <Label className="text-xs">O que voce quer comunicar?</Label>
                            <Textarea
                                placeholder="Descreva o que voce quer no post... Ex: Post sobre o dia do mel, fundo branco, texto na imagem"
                                value={additionalContext}
                                onChange={(e) => setAdditionalContext(e.target.value)}
                                rows={4}
                                className="rounded-none text-sm"
                            />
                            <p className="text-[10px] text-muted-foreground">
                                Dica: Mencione &quot;fundo branco&quot;, &quot;texto na imagem&quot;, &quot;minimalista&quot; para customizar a imagem
                            </p>
                        </div>

                        {/* Image Upload - Compact */}
                        <div className="p-4 border-b space-y-1">
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
                                        Enviar imagens do produto
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

                        {/* Credits info */}
                        <div className="p-4">
                            <p className="text-[10px] text-muted-foreground">
                                Custo: 2 creditos (1 legenda + 1 imagem) | Saldo: {userQuota?.remaining ?? 0} creditos
                            </p>
                        </div>
                    </div>
                </aside>

                {/* Right Column - Preview/Result */}
                <div className="rounded-none border bg-card p-4 flex flex-col min-h-0">
                    <div className="border-b pb-3 mb-4">
                        <h2 className="font-medium text-sm">
                            {generatedPost ? "Post Gerado" : "Preview"}
                        </h2>
                    </div>
                    
                    {isGenerating ? (
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <HugeiconsIcon icon={Loading03Icon} className="size-10 animate-spin text-primary mb-3" />
                            <p className="text-sm text-muted-foreground">Gerando post...</p>
                            <p className="text-xs text-muted-foreground mt-1">Isso pode levar ate 30s</p>
                        </div>
                    ) : generatedPost && generatedPostData ? (
                        <div className="flex-1 min-h-0 overflow-y-auto">
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] min-h-0">
                                <div className="flex flex-col min-h-0 gap-3">
                                    {/* Generated Image with regenerate overlay */}
                                    <div className="relative w-full max-w-[420px] aspect-[4/5] rounded-none bg-muted/50 border overflow-hidden group mx-auto">
                                        {isRegeneratingImage ? (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-muted/80">
                                                <HugeiconsIcon icon={Loading03Icon} className="size-8 animate-spin text-primary mb-2" />
                                                <p className="text-xs text-muted-foreground">Regenerando imagem...</p>
                                            </div>
                                        ) : generatedPostData.imageUrl ? (
                                            <>
                                                <img
                                                    src={generatedPostData.imageUrl}
                                                    alt="Generated"
                                                    className="w-full h-full object-contain"
                                                />
                                                {/* Hover overlay with actions */}
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        className="rounded-none"
                                                        onClick={() => setShowFeedbackFor(showFeedbackFor === "image" ? null : "image")}
                                                    >
                                                        <HugeiconsIcon icon={RefreshIcon} className="size-3 mr-1" />
                                                        Regenerar
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        className="rounded-none"
                                                        asChild
                                                    >
                                                        <a href={generatedPostData.imageUrl} download>
                                                            <HugeiconsIcon icon={Download01Icon} className="size-3" />
                                                        </a>
                                                    </Button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                <HugeiconsIcon icon={Image01Icon} className="size-8 opacity-30" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Feedback input for image regeneration */}
                                    {showFeedbackFor === "image" && (
                                        <div className="p-3 border bg-muted/30 space-y-2">
                                            <Label className="text-xs">O que voce quer mudar na imagem?</Label>
                                            <Textarea
                                                placeholder="Ex: Fundo branco, mais claro, foco no produto..."
                                                value={feedback}
                                                onChange={(e) => setFeedback(e.target.value)}
                                                rows={2}
                                                className="rounded-none text-sm"
                                            />
                                            <div className="flex gap-2 items-center">
                                                <Button
                                                    size="sm"
                                                    className="rounded-none gap-1"
                                                    onClick={() => showRegenerateConfirmation("image")}
                                                    disabled={isRegeneratingImage}
                                                >
                                                    {isRegeneratingImage ? (
                                                        <HugeiconsIcon icon={Loading03Icon} className="size-3 animate-spin" />
                                                    ) : (
                                                        <HugeiconsIcon icon={RefreshIcon} className="size-3" />
                                                    )}
                                                    Regenerar Imagem
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="rounded-none"
                                                    onClick={() => { setShowFeedbackFor(null); setFeedback(""); }}
                                                >
                                                    Cancelar
                                                </Button>
                                                <span className="text-xs text-muted-foreground ml-auto">
                                                    1 credito
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Caption section */}
                                <div className="flex flex-col min-h-0 border-t border-border/60 pt-4 lg:border-t-0 lg:pt-0 lg:border-l lg:border-border/60 lg:pl-4">
                                    <div className="flex items-center justify-between mb-2 shrink-0">
                                        <p className="text-xs text-muted-foreground">Legenda</p>
                                        <div className="flex gap-1">
                                            {!isEditingCaption && (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 px-2"
                                                        onClick={handleStartEditCaption}
                                                        title="Editar legenda"
                                                    >
                                                        <HugeiconsIcon icon={Edit01Icon} className="size-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 px-2"
                                                        onClick={() => setShowFeedbackFor(showFeedbackFor === "caption" ? null : "caption")}
                                                        title="Regenerar legenda"
                                                    >
                                                        <HugeiconsIcon icon={RefreshIcon} className="size-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 px-2"
                                                        onClick={handleCopyCaption}
                                                        title="Copiar legenda"
                                                    >
                                                        <HugeiconsIcon icon={copied ? Tick01Icon : Copy01Icon} className="size-3" />
                                                    </Button>
                                                    {generationHistory && generationHistory.length > 0 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 px-2"
                                                            onClick={() => setShowHistory(!showHistory)}
                                                            title="Ver historico"
                                                        >
                                                            <HugeiconsIcon icon={Clock01Icon} className="size-3" />
                                                            <span className="text-[10px] ml-1">{generationHistory.length}</span>
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Feedback input for caption regeneration */}
                                    {showFeedbackFor === "caption" && !isEditingCaption && (
                                        <div className="mb-3 p-3 border bg-muted/30 space-y-2 shrink-0">
                                            <Label className="text-xs">O que voce quer mudar na legenda?</Label>
                                            <Textarea
                                                placeholder="Ex: Tom mais casual, adicionar emojis, mais curta..."
                                                value={feedback}
                                                onChange={(e) => setFeedback(e.target.value)}
                                                rows={2}
                                                className="rounded-none text-sm"
                                            />
                                            <div className="flex gap-2 items-center flex-wrap">
                                                <Button
                                                    size="sm"
                                                    className="rounded-none gap-1"
                                                    onClick={() => showRegenerateConfirmation("caption")}
                                                    disabled={isRegeneratingCaption}
                                                >
                                                    {isRegeneratingCaption ? (
                                                        <HugeiconsIcon icon={Loading03Icon} className="size-3 animate-spin" />
                                                    ) : (
                                                        <HugeiconsIcon icon={TextIcon} className="size-3" />
                                                    )}
                                                    Regenerar Legenda
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-none gap-1"
                                                    onClick={() => showRegenerateConfirmation("both")}
                                                    disabled={isRegeneratingCaption}
                                                >
                                                    <HugeiconsIcon icon={SparklesIcon} className="size-3" />
                                                    Regenerar Tudo
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="rounded-none"
                                                    onClick={() => { setShowFeedbackFor(null); setFeedback(""); }}
                                                >
                                                    Cancelar
                                                </Button>
                                                <span className="text-xs text-muted-foreground ml-auto">
                                                    1-2 creditos
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Editable caption or display */}
                                    {isEditingCaption ? (
                                        <div className="flex-1 flex flex-col min-h-0">
                                            <Textarea
                                                value={editedCaption}
                                                onChange={(e) => setEditedCaption(e.target.value)}
                                                className="flex-1 rounded-none text-sm min-h-[120px]"
                                            />
                                            <div className="flex gap-2 mt-2 shrink-0">
                                                <Button
                                                    size="sm"
                                                    className="rounded-none gap-1"
                                                    onClick={handleSaveCaption}
                                                >
                                                    <HugeiconsIcon icon={Tick01Icon} className="size-3" />
                                                    Salvar
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="rounded-none gap-1"
                                                    onClick={handleCancelEditCaption}
                                                >
                                                    <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                                                    Cancelar
                                                </Button>
                                            </div>
                                        </div>
                                    ) : isRegeneratingCaption ? (
                                        <div className="flex-1 flex items-center justify-center">
                                            <div className="text-center">
                                                <HugeiconsIcon icon={Loading03Icon} className="size-6 animate-spin text-primary mx-auto mb-2" />
                                                <p className="text-xs text-muted-foreground">Regenerando legenda...</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 min-h-0 overflow-y-auto">
                                            <p className="text-sm whitespace-pre-wrap">{generatedPostData.caption}</p>
                                        </div>
                                    )}

                                    {/* Version History Panel */}
                                    {showHistory && generationHistory && generationHistory.length > 0 && (
                                        <div className="mt-3 pt-3 border-t shrink-0">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-xs font-medium">Historico de versoes</p>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-5 px-1"
                                                    onClick={() => setShowHistory(false)}
                                                >
                                                    <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                                                </Button>
                                            </div>
                                            <div className="space-y-2 max-h-[150px] overflow-y-auto">
                                                {generationHistory.map((version) => (
                                                    <div
                                                        key={version._id}
                                                        className="flex items-start gap-2 p-2 border bg-muted/20 hover:bg-muted/40 transition-colors"
                                                    >
                                                        {/* Thumbnail */}
                                                        <div className="size-10 shrink-0 bg-muted rounded-none overflow-hidden">
                                                            {version.imageUrl ? (
                                                                <img
                                                                    src={version.imageUrl}
                                                                    alt={`v${version.version}`}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <HugeiconsIcon icon={Image01Icon} className="size-4 opacity-30" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs font-medium">v{version.version}</span>
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {version.action === "initial" && "Inicial"}
                                                                    {version.action === "regenerate_image" && "Imagem"}
                                                                    {version.action === "regenerate_caption" && "Legenda"}
                                                                    {version.action === "regenerate_both" && "Tudo"}
                                                                    {version.action === "edit_caption" && "Editado"}
                                                                    {version.action === "restore" && "Restaurado"}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground truncate">
                                                                {version.caption.substring(0, 50)}...
                                                            </p>
                                                            {version.feedback && (
                                                                <p className="text-[10px] text-muted-foreground italic truncate">
                                                                    &ldquo;{version.feedback}&rdquo;
                                                                </p>
                                                            )}
                                                        </div>
                                                        {/* Restore button */}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 px-2 shrink-0"
                                                            onClick={() => handleRestoreVersion(version.version)}
                                                            title="Restaurar esta versao"
                                                        >
                                                            <HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center text-muted-foreground">
                                <HugeiconsIcon icon={SparklesIcon} className="size-8 mx-auto mb-2 opacity-30" />
                                <p className="text-xs">Selecione o tipo de post e descreva o que voce quer</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Dialog for Regeneration */}
            <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar regeneracao</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmDialog.type === "image" && "Voce esta prestes a regenerar a imagem."}
                            {confirmDialog.type === "caption" && "Voce esta prestes a regenerar a legenda."}
                            {confirmDialog.type === "both" && "Voce esta prestes a regenerar a legenda e a imagem."}
                            <br /><br />
                            <span className="font-medium">Custo:</span> {confirmDialog.credits} credito{confirmDialog.credits > 1 ? "s" : ""}
                            <br />
                            <span className="font-medium">Creditos restantes:</span> {userQuota?.remaining ?? 0}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleConfirmedRegenerate}
                            disabled={(userQuota?.remaining ?? 0) < confirmDialog.credits}
                        >
                            Confirmar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
