import { autumn } from "../autumn";
import { throwImageGenerationError } from "../imageGenerationErrors";

const IMAGE_FEATURE_ID = "images_generated";

function formatInsufficientCredits(required: number, remaining?: number): string {
    if (remaining === undefined) {
        return `Você precisa de ${required} crédito(s) para esta geração. Veja seus planos para continuar.`;
    }

    return `Você precisa de ${required} crédito(s) para esta geração, mas só tem ${remaining}. Veja seus planos para continuar.`;
}

function getRemainingBalance(data: any): number | undefined {
    if (!data) return undefined;

    if (typeof data.balance === "number") {
        return Math.max(0, data.balance);
    }

    const usage = typeof data.usage === "number" ? data.usage : 0;
    const limit =
        typeof data.usage_limit === "number"
            ? data.usage_limit
            : typeof data.included_usage === "number"
                ? data.included_usage
                : undefined;

    if (limit === undefined) {
        return undefined;
    }

    return Math.max(0, limit - usage);
}

export async function reserveImageUsage(ctx: any, count: number): Promise<number> {
    const normalized = Math.max(0, Math.ceil(count));
    if (normalized === 0) {
        return 0;
    }

    const result = await autumn.check(ctx, {
        featureId: IMAGE_FEATURE_ID,
        requiredBalance: normalized,
        sendEvent: true,
    });

    if (result.error) {
        throwImageGenerationError("GENERATION_FAILED", {
            title: "Não foi possível verificar seu plano",
            message: "Houve um problema ao verificar seus créditos. Tente novamente em instantes.",
        });
    }

    if (!result.data?.allowed) {
        const customerResult = await autumn.customers.get(ctx);
        if (customerResult.error) {
            throwImageGenerationError("GENERATION_FAILED", {
                title: "Não foi possível verificar seu plano",
                message: "Houve um problema ao verificar seus créditos. Tente novamente em instantes.",
            });
        }

        const hasActivePlan = !!customerResult.data?.products?.some(
            (product: { status?: string }) =>
                product.status === "active" || product.status === "trialing"
        );

        if (!hasActivePlan) {
            throwImageGenerationError("PLAN_REQUIRED", {
                message: "Você ainda não tem um plano ativo. Assine um plano para liberar a geração de imagens.",
            });
        }

        const remaining = getRemainingBalance(result.data);
        throwImageGenerationError("CREDITS_EXHAUSTED", {
            message: formatInsufficientCredits(normalized, remaining),
        });
    }

    return normalized;
}

export async function refundImageUsage(ctx: any, count: number): Promise<void> {
    const normalized = Math.max(0, Math.ceil(count));
    if (normalized === 0) {
        return;
    }

    try {
        const result = await autumn.track(ctx, {
            featureId: IMAGE_FEATURE_ID,
            value: -normalized,
        });

        if (result.error) {
            console.error("Failed to refund usage:", result.error.message || result.error);
        }
    } catch (err) {
        console.error("Failed to refund usage:", err);
    }
}
