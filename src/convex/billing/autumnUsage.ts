import {
    STUDIO_CREDIT_FEATURE_ID,
    formatCredits,
    groupUsageLineItems,
    sumUsageLineItemCredits,
    type UsageLineItem,
} from "../../lib/billing/aiCredits";
import { autumn } from "../autumn";
import { throwImageGenerationError } from "../imageGenerationErrors";

export type ReservationJournalEntry = UsageLineItem;

export type BillingUsageOverview = {
    monthlyIncluded: number;
    monthlyUsed: number;
    monthlyRemaining: number;
    extraIncluded: number;
    extraRemaining: number;
    totalRemaining: number;
    nextResetAt?: number;
};

function formatInsufficientCredits(required: number, remaining?: number): string {
    const requiredLabel = formatCredits(required, 2);
    if (remaining === undefined) {
        return `Esta acao precisa de ${requiredLabel} credito(s). Veja seus planos para continuar.`;
    }

    return `Esta acao precisa de ${requiredLabel} credito(s), mas voce so tem ${formatCredits(remaining, 2)} disponiveis. Veja seus planos para continuar.`;
}

function asNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getStudioCreditBalance(customerData: any): any {
    if (customerData?.balances?.[STUDIO_CREDIT_FEATURE_ID]) {
        return customerData.balances[STUDIO_CREDIT_FEATURE_ID];
    }

    if (customerData?.features?.[STUDIO_CREDIT_FEATURE_ID]) {
        return customerData.features[STUDIO_CREDIT_FEATURE_ID];
    }

    return undefined;
}

function normalizeBreakdownEntry(entry: any) {
    return {
        includedUsage: asNumber(entry?.included_usage) ?? 0,
        usage: asNumber(entry?.usage) ?? 0,
        balance: asNumber(entry?.balance) ?? 0,
        interval: typeof entry?.interval === "string" ? entry.interval : undefined,
        nextResetAt: asNumber(entry?.next_reset_at),
    };
}

type BalanceBreakdownEntry = ReturnType<typeof normalizeBreakdownEntry>;

export function getBillingUsageOverview(customerData: any): BillingUsageOverview {
    const balance = getStudioCreditBalance(customerData);
    const breakdown: BalanceBreakdownEntry[] = Array.isArray(balance?.breakdown)
        ? balance.breakdown.map(normalizeBreakdownEntry)
        : [];

    const monthlyEntries = breakdown.filter((entry) => entry.interval === "month");
    const oneOffEntries = breakdown.filter((entry) => entry.interval === "one_off");

    const monthlyIncluded = monthlyEntries.reduce(
        (total, entry) => total + entry.includedUsage,
        0
    );
    const monthlyUsed = monthlyEntries.reduce((total, entry) => total + entry.usage, 0);
    const monthlyRemaining = monthlyEntries.reduce(
        (total, entry) => total + entry.balance,
        0
    );
    const extraIncluded = oneOffEntries.reduce(
        (total, entry) => total + entry.includedUsage,
        0
    );
    const extraRemaining = oneOffEntries.reduce((total, entry) => total + entry.balance, 0);

    const nextResetAt = monthlyEntries
        .map((entry) => entry.nextResetAt)
        .filter((value): value is number => value !== undefined)
        .sort((left, right) => left - right)[0];

    return {
        monthlyIncluded:
            monthlyIncluded ||
            asNumber(balance?.included_usage) ||
            asNumber(balance?.usage_limit) ||
            0,
        monthlyUsed,
        monthlyRemaining,
        extraIncluded,
        extraRemaining,
        totalRemaining:
            monthlyRemaining +
            extraRemaining +
            (breakdown.length === 0 ? asNumber(balance?.balance) ?? 0 : 0),
        ...(nextResetAt !== undefined ? { nextResetAt } : {}),
    };
}

function getRemainingCreditsFromCheck(data: any): number | undefined {
    const nestedBalance = asNumber(data?.balance?.balance);
    if (nestedBalance !== undefined) {
        return Math.max(0, nestedBalance);
    }

    const directBalance = asNumber(data?.balance);
    if (directBalance !== undefined) {
        return Math.max(0, directBalance);
    }

    const creditBalance = getStudioCreditBalance(data);
    if (creditBalance) {
        return Math.max(0, asNumber(creditBalance.balance) ?? 0);
    }

    return undefined;
}

async function throwBillingAccessError(
    ctx: any,
    requiredCredits: number,
    remainingCredits?: number
): Promise<never> {
    const customerResult = await autumn.customers.get(ctx);
    if (customerResult.error) {
        throwImageGenerationError("GENERATION_FAILED", {
            title: "Nao foi possivel verificar seu plano",
            message: "Houve um problema ao verificar seus creditos. Tente novamente em instantes.",
        });
    }

    const hasActivePlan = !!customerResult.data?.products?.some(
        (product: { status?: string }) =>
            product.status === "active" || product.status === "trialing"
    );

    if (!hasActivePlan) {
        throwImageGenerationError("PLAN_REQUIRED", {
            message:
                "Voce ainda nao tem um plano ativo. Assine um plano para liberar a geracao com creditos.",
        });
    }

    const resolvedRemaining =
        remainingCredits ?? getBillingUsageOverview(customerResult.data).totalRemaining;

    throwImageGenerationError("CREDITS_EXHAUSTED", {
        message: formatInsufficientCredits(requiredCredits, resolvedRemaining),
    });
}

export async function reserveAiUsage(
    ctx: any,
    items: UsageLineItem[]
): Promise<ReservationJournalEntry[]> {
    const groupedItems = groupUsageLineItems(
        items.filter((item) => item.quantity > 0 && item.credits > 0)
    );

    if (groupedItems.length === 0) {
        return [];
    }

    const reservations: ReservationJournalEntry[] = [];

    try {
        for (const item of groupedItems) {
            const result = await autumn.check(ctx, {
                featureId: item.featureId,
                requiredBalance: item.quantity,
                sendEvent: true,
            });

            if (result.error) {
                throwImageGenerationError("GENERATION_FAILED", {
                    title: "Nao foi possivel verificar seu plano",
                    message:
                        "Houve um problema ao verificar seus creditos. Tente novamente em instantes.",
                });
            }

            if (!result.data?.allowed) {
                const requiredCredits = sumUsageLineItemCredits(groupedItems);
                const remainingCredits = getRemainingCreditsFromCheck(result.data);
                await throwBillingAccessError(ctx, requiredCredits, remainingCredits);
            }

            reservations.push(item);
        }
    } catch (error) {
        if (reservations.length > 0) {
            await refundAiUsage(ctx, reservations);
        }
        throw error;
    }

    return reservations;
}

export async function refundAiUsage(
    ctx: any,
    items: UsageLineItem[] | ReservationJournalEntry[]
): Promise<void> {
    const groupedItems = groupUsageLineItems(items);

    for (const item of groupedItems) {
        try {
            const result = await autumn.track(ctx, {
                featureId: item.featureId,
                value: -item.quantity,
            });

            if (result.error) {
                console.error(
                    "Failed to refund usage:",
                    result.error.message || result.error
                );
            }
        } catch (err) {
            console.error("Failed to refund usage:", err);
        }
    }
}
