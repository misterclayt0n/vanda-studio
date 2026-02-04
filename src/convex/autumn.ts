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

        const customerData: { name?: string; email?: string } = {};
        if (user.name) customerData.name = user.name as string;
        if (user.email) customerData.email = user.email as string;

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
