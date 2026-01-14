import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Save a version to history
export const saveVersion = mutation({
    args: {
        generatedPostId: v.id("generated_posts"),
        caption: v.string(),
        imageStorageId: v.optional(v.id("_storage")),
        imagePrompt: v.optional(v.string()),
        action: v.string(),
        feedback: v.optional(v.string()),
        model: v.optional(v.string()),
        imageModel: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // Get the post to verify ownership
        const post = await ctx.db.get(args.generatedPostId);
        if (!post) {
            throw new Error("Generated post not found");
        }

        // Get the latest version number
        const existingVersions = await ctx.db
            .query("generation_history")
            .withIndex("by_generated_post_id", (q) => q.eq("generatedPostId", args.generatedPostId))
            .collect();

        const nextVersion = existingVersions.length + 1;

        return await ctx.db.insert("generation_history", {
            generatedPostId: args.generatedPostId,
            version: nextVersion,
            caption: args.caption,
            ...(args.imageStorageId && { imageStorageId: args.imageStorageId }),
            ...(args.imagePrompt && { imagePrompt: args.imagePrompt }),
            action: args.action,
            ...(args.feedback && { feedback: args.feedback }),
            ...(args.model && { model: args.model }),
            ...(args.imageModel && { imageModel: args.imageModel }),
            createdAt: Date.now(),
        });
    },
});

// Get all versions for a generated post
export const getHistory = query({
    args: {
        generatedPostId: v.id("generated_posts"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const versions = await ctx.db
            .query("generation_history")
            .withIndex("by_generated_post_id", (q) => q.eq("generatedPostId", args.generatedPostId))
            .order("desc")
            .collect();

        // Resolve image URLs
        return Promise.all(
            versions.map(async (version) => {
                let imageUrl: string | null = null;
                if (version.imageStorageId) {
                    imageUrl = await ctx.storage.getUrl(version.imageStorageId);
                }
                return {
                    ...version,
                    imageUrl,
                };
            })
        );
    },
});

// Get a specific version
export const getVersion = query({
    args: {
        generatedPostId: v.id("generated_posts"),
        version: v.number(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const versionDoc = await ctx.db
            .query("generation_history")
            .withIndex("by_version", (q) => 
                q.eq("generatedPostId", args.generatedPostId).eq("version", args.version)
            )
            .unique();

        if (!versionDoc) {
            return null;
        }

        let imageUrl: string | null = null;
        if (versionDoc.imageStorageId) {
            imageUrl = await ctx.storage.getUrl(versionDoc.imageStorageId);
        }

        return {
            ...versionDoc,
            imageUrl,
        };
    },
});

// Restore a previous version (makes it the current version on the generated post)
export const restoreVersion = mutation({
    args: {
        generatedPostId: v.id("generated_posts"),
        version: v.number(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // Get the version to restore
        const versionDoc = await ctx.db
            .query("generation_history")
            .withIndex("by_version", (q) => 
                q.eq("generatedPostId", args.generatedPostId).eq("version", args.version)
            )
            .unique();

        if (!versionDoc) {
            throw new Error("Version not found");
        }

        // Update the generated post with this version's content
        await ctx.db.patch(args.generatedPostId, {
            caption: versionDoc.caption,
            imageStorageId: versionDoc.imageStorageId,
            imagePrompt: versionDoc.imagePrompt,
            status: "regenerated",
            updatedAt: Date.now(),
        });

        // Save this restore action as a new version in history
        const existingVersions = await ctx.db
            .query("generation_history")
            .withIndex("by_generated_post_id", (q) => q.eq("generatedPostId", args.generatedPostId))
            .collect();

        await ctx.db.insert("generation_history", {
            generatedPostId: args.generatedPostId,
            version: existingVersions.length + 1,
            caption: versionDoc.caption,
            ...(versionDoc.imageStorageId && { imageStorageId: versionDoc.imageStorageId }),
            ...(versionDoc.imagePrompt && { imagePrompt: versionDoc.imagePrompt }),
            action: "restore",
            feedback: `Restored from version ${args.version}`,
            ...(versionDoc.model && { model: versionDoc.model }),
            ...(versionDoc.imageModel && { imageModel: versionDoc.imageModel }),
            createdAt: Date.now(),
        });

        return { success: true };
    },
});
