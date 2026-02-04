import { autumn } from "../autumn";

const IMAGE_FEATURE_ID = "images_generated";

function formatInsufficientCredits(required: number, remaining?: number): string {
    if (remaining === undefined) {
        return `Creditos insuficientes. Necessario: ${required}.`;
    }

    return `Creditos insuficientes. Voce tem ${remaining} credito(s), mas precisa de ${required}.`;
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
        throw new Error(result.error.message || "Falha ao verificar creditos");
    }

    if (!result.data?.allowed) {
        const remaining = getRemainingBalance(result.data);
        throw new Error(formatInsufficientCredits(normalized, remaining));
    }

    return normalized;
}

export async function refundImageUsage(ctx: any, count: number): Promise<void> {
    const normalized = Math.max(0, Math.ceil(count));
    if (normalized === 0) {
        return;
    }

    const result = await autumn.track(ctx, {
        featureId: IMAGE_FEATURE_ID,
        value: -normalized,
    });

    if (result.error) {
        console.error("Failed to refund usage:", result.error.message || result.error);
    }
}
