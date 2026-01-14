import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get a single generated post with resolved image URL
export const get = query({
    args: {
        id: v.id("generated_posts"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const post = await ctx.db.get(args.id);
        if (!post) {
            return null;
        }

        // Verify user owns the project
        const project = await ctx.db.get(post.projectId);
        if (!project) {
            return null;
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || project.userId !== user._id) {
            return null;
        }

        // Resolve image URL if available
        let imageUrl: string | null = null;
        if (post.imageStorageId) {
            imageUrl = await ctx.storage.getUrl(post.imageStorageId);
        }

        return {
            ...post,
            imageUrl,
        };
    },
});

// List all generated posts for a project
export const listByProject = query({
    args: {
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        // Verify user owns the project
        const project = await ctx.db.get(args.projectId);
        if (!project) {
            return [];
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || project.userId !== user._id) {
            return [];
        }

        const posts = await ctx.db
            .query("generated_posts")
            .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
            .order("desc")
            .collect();

        // Resolve image URLs
        return Promise.all(
            posts.map(async (post) => {
                let imageUrl: string | null = null;
                if (post.imageStorageId) {
                    imageUrl = await ctx.storage.getUrl(post.imageStorageId);
                }
                return {
                    ...post,
                    imageUrl,
                };
            })
        );
    },
});

// Get count of generated posts for a project
export const countByProject = query({
    args: {
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return 0;
        }

        const posts = await ctx.db
            .query("generated_posts")
            .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
            .collect();

        return posts.length;
    },
});

// Create a new generated post
export const create = mutation({
    args: {
        projectId: v.id("projects"),
        caption: v.string(),
        sourcePostIds: v.optional(v.array(v.id("instagram_posts"))),
        reasoning: v.optional(v.string()),
        model: v.optional(v.string()),
        imageStorageId: v.optional(v.id("_storage")),
        imagePrompt: v.optional(v.string()),
        imageModel: v.optional(v.string()),
        status: v.optional(v.string()), // "generated" | "in_progress"
        // Full brief used for generation
        brief: v.optional(v.object({
            postType: v.string(),
            contentPillar: v.optional(v.string()),
            customTopic: v.optional(v.string()),
            toneOverride: v.optional(v.array(v.string())),
            captionLength: v.optional(v.string()),
            includeHashtags: v.optional(v.boolean()),
            additionalContext: v.optional(v.string()),
            referenceText: v.optional(v.string()),
            referenceImageIds: v.optional(v.array(v.id("_storage"))),
        })),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // Verify user owns the project
        const project = await ctx.db.get(args.projectId);
        if (!project) {
            throw new Error("Project not found");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || project.userId !== user._id) {
            throw new Error("Not authorized");
        }

        const now = Date.now();
        return await ctx.db.insert("generated_posts", {
            projectId: args.projectId,
            caption: args.caption,
            sourcePostIds: args.sourcePostIds ?? [],
            ...(args.reasoning && { reasoning: args.reasoning }),
            ...(args.model && { model: args.model }),
            ...(args.imageStorageId && { imageStorageId: args.imageStorageId }),
            ...(args.imagePrompt && { imagePrompt: args.imagePrompt }),
            ...(args.imageModel && { imageModel: args.imageModel }),
            ...(args.brief && { brief: args.brief }),
            status: args.status ?? "generated",
            createdAt: now,
            updatedAt: now,
        });
    },
});

// Update from chat (for chat-based generation)
export const updateFromChat = mutation({
    args: {
        id: v.id("generated_posts"),
        caption: v.optional(v.string()),
        imageStorageId: v.optional(v.id("_storage")),
        imagePrompt: v.optional(v.string()),
        model: v.optional(v.string()),
        imageModel: v.optional(v.string()),
        status: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const post = await ctx.db.get(args.id);
        if (!post) {
            throw new Error("Generated post not found");
        }

        // Verify user owns the project
        const project = await ctx.db.get(post.projectId);
        if (!project) {
            throw new Error("Project not found");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || project.userId !== user._id) {
            throw new Error("Not authorized");
        }

        await ctx.db.patch(args.id, {
            ...(args.caption && { caption: args.caption }),
            ...(args.imageStorageId && { imageStorageId: args.imageStorageId }),
            ...(args.imagePrompt && { imagePrompt: args.imagePrompt }),
            ...(args.model && { model: args.model }),
            ...(args.imageModel && { imageModel: args.imageModel }),
            ...(args.status && { status: args.status }),
            updatedAt: Date.now(),
        });
    },
});

// Update caption (for editing) - also saves to history
export const updateCaption = mutation({
    args: {
        id: v.id("generated_posts"),
        caption: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const post = await ctx.db.get(args.id);
        if (!post) {
            throw new Error("Generated post not found");
        }

        // Verify user owns the project
        const project = await ctx.db.get(post.projectId);
        if (!project) {
            throw new Error("Project not found");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || project.userId !== user._id) {
            throw new Error("Not authorized");
        }

        // Save to history before updating
        const existingVersions = await ctx.db
            .query("generation_history")
            .withIndex("by_generated_post_id", (q) => q.eq("generatedPostId", args.id))
            .collect();

        await ctx.db.insert("generation_history", {
            generatedPostId: args.id,
            version: existingVersions.length + 1,
            caption: args.caption,
            ...(post.imageStorageId && { imageStorageId: post.imageStorageId }),
            ...(post.imagePrompt && { imagePrompt: post.imagePrompt }),
            action: "edit_caption",
            ...(post.model && { model: post.model }),
            ...(post.imageModel && { imageModel: post.imageModel }),
            createdAt: Date.now(),
        });

        await ctx.db.patch(args.id, {
            caption: args.caption,
            status: "edited",
            updatedAt: Date.now(),
        });
    },
});

// Update image (after regeneration)
export const updateImage = mutation({
    args: {
        id: v.id("generated_posts"),
        imageStorageId: v.id("_storage"),
        imagePrompt: v.string(),
        imageModel: v.optional(v.string()),
        feedback: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const post = await ctx.db.get(args.id);
        if (!post) {
            throw new Error("Generated post not found");
        }

        // Verify user owns the project
        const project = await ctx.db.get(post.projectId);
        if (!project) {
            throw new Error("Project not found");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || project.userId !== user._id) {
            throw new Error("Not authorized");
        }

        // Save to history before updating
        const existingVersions = await ctx.db
            .query("generation_history")
            .withIndex("by_generated_post_id", (q) => q.eq("generatedPostId", args.id))
            .collect();

        await ctx.db.insert("generation_history", {
            generatedPostId: args.id,
            version: existingVersions.length + 1,
            caption: post.caption,
            imageStorageId: args.imageStorageId,
            imagePrompt: args.imagePrompt,
            action: "regenerate_image",
            ...(args.feedback && { feedback: args.feedback }),
            ...(post.model && { model: post.model }),
            ...(args.imageModel && { imageModel: args.imageModel }),
            createdAt: Date.now(),
        });

        await ctx.db.patch(args.id, {
            imageStorageId: args.imageStorageId,
            imagePrompt: args.imagePrompt,
            imageModel: args.imageModel,
            status: "regenerated",
            updatedAt: Date.now(),
        });
    },
});

// Update status after regeneration
export const updateRegenerated = mutation({
    args: {
        id: v.id("generated_posts"),
        caption: v.string(),
        reasoning: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const post = await ctx.db.get(args.id);
        if (!post) {
            throw new Error("Generated post not found");
        }

        await ctx.db.patch(args.id, {
            caption: args.caption,
            reasoning: args.reasoning,
            status: "regenerated",
            updatedAt: Date.now(),
        });
    },
});

// Delete a generated post
export const remove = mutation({
    args: {
        id: v.id("generated_posts"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const post = await ctx.db.get(args.id);
        if (!post) {
            throw new Error("Generated post not found");
        }

        // Verify user owns the project
        const project = await ctx.db.get(post.projectId);
        if (!project) {
            throw new Error("Project not found");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || project.userId !== user._id) {
            throw new Error("Not authorized");
        }

        // Delete associated history
        const history = await ctx.db
            .query("generation_history")
            .withIndex("by_generated_post_id", (q) => q.eq("generatedPostId", args.id))
            .collect();
        
        for (const h of history) {
            await ctx.db.delete(h._id);
        }

        await ctx.db.delete(args.id);
    },
});
