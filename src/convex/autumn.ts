import { components } from "./_generated/api";
import { Autumn } from "@useautumn/convex";

const secretKey = process.env.AUTUMN_SECRET_KEY;
if (!secretKey) {
    throw new Error("AUTUMN_SECRET_KEY not configured");
}

const autumnComponent = (components as { autumn?: unknown }).autumn;
if (!autumnComponent) {
    throw new Error("Autumn component not configured in convex.config.ts");
}

export const autumn = new Autumn(autumnComponent, {
    secretKey,
    identify: async (ctx: any) => {
        const user = await ctx.auth.getUserIdentity();
        if (!user) return null;

        const fingerprint = (() => {
            const candidate =
                (typeof (user as any).sessionId === "string" && (user as any).sessionId) ||
                (typeof (user as any).session_id === "string" && (user as any).session_id) ||
                (typeof (user as any).sid === "string" && (user as any).sid) ||
                (typeof (user as any).ip === "string" && (user as any).ip) ||
                (typeof user.tokenIdentifier === "string" && user.tokenIdentifier);

            if (!candidate) {
                return undefined;
            }

            // Simple stable hash (FNV-1a) to avoid storing raw identifiers.
            let hash = 2166136261;
            for (let i = 0; i < candidate.length; i += 1) {
                hash ^= candidate.charCodeAt(i);
                hash = Math.imul(hash, 16777619);
            }
            return (hash >>> 0).toString(16);
        })();

        const customerData: { name?: string; email?: string; fingerprint?: string } = {};
        if (user.name) customerData.name = user.name as string;
        if (user.email) customerData.email = user.email as string;
        if (fingerprint) customerData.fingerprint = fingerprint;

        return {
            customerId: user.subject as string,
            customerData,
        };
    },
});

export const {
    track,
    check,
    checkout,
    attach,
    query,
    billingPortal,
    createCustomer,
    listProducts,
    usage,
} = autumn.api();
