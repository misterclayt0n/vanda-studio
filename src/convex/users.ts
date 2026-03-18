import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function normalizeName(name: string | undefined | null, email: string | undefined | null): string {
    const trimmedName = name?.trim();
    if (trimmedName) {
        return trimmedName;
    }

    const emailLocalPart = email?.split("@")[0]?.trim();
    if (emailLocalPart) {
        return emailLocalPart;
    }

    return "Usuário";
}

function normalizeEmail(email: string | undefined | null): string {
    return email?.trim() || "";
}

export const store = mutation({
    args: {
        name: v.string(),
        email: v.string(),
        imageUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Called storeUser without authentication present");
        }

        // Check if we've already stored this identity before.
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (user !== null) {
            // If we've seen this identity before but the name has changed, patch the value.
            if (user.name !== args.name || user.email !== args.email || user.imageUrl !== args.imageUrl) {
                await ctx.db.patch(user._id, { name: args.name, email: args.email, imageUrl: args.imageUrl });
            }
            return user._id;
        }

        // If it's a new identity, create a new `User`.
        const userId = await ctx.db.insert("users", {
            name: args.name,
            email: args.email,
            clerkId: identity.subject,
            ...(args.imageUrl && { imageUrl: args.imageUrl }),
        });

        return userId;
    },
});

export const ensureCurrent = mutation({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Called ensureCurrentUser without authentication present");
        }

        const normalizedName = normalizeName(
            typeof identity.name === "string" ? identity.name : undefined,
            typeof identity.email === "string" ? identity.email : undefined
        );
        const normalizedEmail = normalizeEmail(
            typeof identity.email === "string" ? identity.email : undefined
        );

        const existingUser = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (existingUser) {
            if (existingUser.name !== normalizedName || existingUser.email !== normalizedEmail) {
                await ctx.db.patch(existingUser._id, {
                    name: normalizedName,
                    email: normalizedEmail,
                });
                return {
                    ...existingUser,
                    name: normalizedName,
                    email: normalizedEmail,
                };
            }

            return existingUser;
        }

        const userId = await ctx.db.insert("users", {
            name: normalizedName,
            email: normalizedEmail,
            clerkId: identity.subject,
        });

        return {
            _id: userId,
            _creationTime: Date.now(),
            name: normalizedName,
            email: normalizedEmail,
            clerkId: identity.subject,
        };
    },
});

export const current = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }
        return await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();
    },
});
