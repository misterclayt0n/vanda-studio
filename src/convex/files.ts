"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const downloadAndStoreFile = action({
    args: { url: v.string() },
    handler: async (ctx, args): Promise<Id<"_storage"> | null> => {
        try {
            const response = await fetch(args.url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; VandaStudio/1.0)",
                },
            });

            if (!response.ok) {
                console.error(`Failed to fetch file: ${response.status} ${response.statusText}`);
                return null;
            }

            const blob = await response.blob();
            const storageId = await ctx.storage.store(blob);
            return storageId;
        } catch (error) {
            console.error("Error downloading and storing file:", error);
            return null;
        }
    },
});
