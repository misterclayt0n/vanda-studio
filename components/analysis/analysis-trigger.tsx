"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiMagicIcon, Loading01Icon, FlashIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

interface AnalysisTriggerProps {
    projectId: Id<"projects">;
    onAnalysisStarted?: () => void;
    onAnalysisComplete?: () => void;
}

export function AnalysisTrigger({
    projectId,
    onAnalysisStarted,
    onAnalysisComplete,
}: AnalysisTriggerProps) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const usageStats = useQuery(api.billing.usage.getUsageStats);
    const requestAnalysis = useAction(api.ai.analysis.requestAnalysis);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        setError(null);
        onAnalysisStarted?.();

        toast.loading("Iniciando analise de IA...", { id: "analysis" });

        try {
            await requestAnalysis({ projectId });
            toast.success("Analise concluida com sucesso!", {
                id: "analysis",
                description: "Confira os resultados abaixo.",
            });
            onAnalysisComplete?.();
        } catch (err) {
            const rawMessage = err instanceof Error ? err.message : "Erro desconhecido";
            const message = translateError(rawMessage);
            setError(message);
            toast.error("Falha na analise", {
                id: "analysis",
                description: message,
            });
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Translate common error messages to Portuguese
    const translateError = (message: string): string => {
        if (message.includes("No prompts remaining")) {
            return "Voce atingiu o limite de analises. Faca upgrade para continuar.";
        }
        if (message.includes("Not authenticated")) {
            return "Voce precisa estar logado para fazer analises.";
        }
        if (message.includes("Project not found")) {
            return "Projeto nao encontrado ou sem permissao de acesso.";
        }
        if (message.includes("Failed to parse JSON")) {
            return "Erro ao processar resposta da IA. Tente novamente.";
        }
        if (message.includes("OpenRouter API error")) {
            return "Erro de conexao com a IA. Tente novamente em alguns segundos.";
        }
        return message;
    };

    const remaining = usageStats ? usageStats.promptsLimit - usageStats.promptsUsed : 0;
    const hasQuota = remaining > 0;

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
                <Button
                    size="sm"
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !hasQuota}
                >
                    {isAnalyzing ? (
                        <>
                            <HugeiconsIcon icon={Loading01Icon} strokeWidth={2} className="size-3.5 animate-spin" />
                            Analisando...
                        </>
                    ) : (
                        <>
                            <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} className="size-3.5" />
                            Analisar com IA
                        </>
                    )}
                </Button>

                {usageStats && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <HugeiconsIcon icon={FlashIcon} strokeWidth={2} className="size-3 text-primary" />
                        <span>
                            <span className="font-medium text-foreground">{remaining}</span>
                            {" "}de{" "}
                            <span className="font-medium">{usageStats.promptsLimit}</span>
                            {" "}restantes
                        </span>
                    </div>
                )}
            </div>

            {error && (
                <p className="text-xs text-destructive">{error}</p>
            )}

            {!hasQuota && usageStats && (
                <p className="text-xs text-muted-foreground">
                    Voce atingiu o limite de analises deste mes.
                    <button className="text-primary hover:underline ml-1">
                        Fazer upgrade para Pro
                    </button>
                </p>
            )}
        </div>
    );
}
