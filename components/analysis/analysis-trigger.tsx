"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Zap } from "lucide-react";

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

        try {
            await requestAnalysis({ projectId });
            onAnalysisComplete?.();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Analysis failed";
            setError(message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const remaining = usageStats ? usageStats.promptsLimit - usageStats.promptsUsed : 0;
    const hasQuota = remaining > 0;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
                <Button
                    variant="gradient"
                    size="lg"
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !hasQuota}
                >
                    {isAnalyzing ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Analisando...
                        </>
                    ) : (
                        <>
                            <Sparkles className="h-5 w-5" />
                            Analisar com IA
                        </>
                    )}
                </Button>

                {usageStats && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Zap className="h-4 w-4 text-primary" />
                        <span>
                            <span className="font-medium text-foreground">{remaining}</span>
                            {" "}de{" "}
                            <span className="font-medium">{usageStats.promptsLimit}</span>
                            {" "}prompts restantes
                        </span>
                    </div>
                )}
            </div>

            {error && (
                <p className="text-sm text-destructive">{error}</p>
            )}

            {!hasQuota && usageStats && (
                <p className="text-sm text-muted-foreground">
                    Você atingiu o limite de análises deste mês.
                    <button className="text-primary hover:underline ml-1">
                        Fazer upgrade para Pro
                    </button>
                </p>
            )}
        </div>
    );
}
