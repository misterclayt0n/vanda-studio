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

        // If post has a project, verify user owns it
        if (post.projectId) {
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
        }
        // For standalone posts (no projectId), auth check above is sufficient

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
        projectId: v.optional(v.id("projects")), // Optional - can be null for standalone posts
        caption: v.string(),
        sourcePostIds: v.optional(v.array(v.id("instagram_posts"))),
        reasoning: v.optional(v.string()),
        model: v.optional(v.string()),
        imageStorageId: v.optional(v.id("_storage")),
        imagePrompt: v.optional(v.string()),
        imageModel: v.optional(v.string()),
        status: v.optional(v.string()), // "generating_caption" | "generating_images" | "generated" | "in_progress"
        // Progressive loading fields
        pendingImageModels: v.optional(v.array(v.string())),
        totalImageModels: v.optional(v.number()),
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

        // Get current user
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        // If projectId is provided, verify user owns the project
        if (args.projectId) {
            const project = await ctx.db.get(args.projectId);
            if (!project) {
                throw new Error("Project not found");
            }

            if (!user || project.userId !== user._id) {
                throw new Error("Not authorized");
            }
        }

        const now = Date.now();
        return await ctx.db.insert("generated_posts", {
            ...(args.projectId && { projectId: args.projectId }),
            ...(user && { userId: user._id }), // Always save userId for tracking
            caption: args.caption,
            sourcePostIds: args.sourcePostIds ?? [],
            ...(args.reasoning && { reasoning: args.reasoning }),
            ...(args.model && { model: args.model }),
            ...(args.imageStorageId && { imageStorageId: args.imageStorageId }),
            ...(args.imagePrompt && { imagePrompt: args.imagePrompt }),
            ...(args.imageModel && { imageModel: args.imageModel }),
            ...(args.brief && { brief: args.brief }),
            ...(args.pendingImageModels && { pendingImageModels: args.pendingImageModels }),
            ...(args.totalImageModels !== undefined && { totalImageModels: args.totalImageModels }),
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
        // Progressive loading fields
        pendingImageModels: v.optional(v.array(v.string())),
        totalImageModels: v.optional(v.number()),
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

        // If post has a project, verify user owns it
        if (post.projectId) {
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
        }
        // For standalone posts (no projectId), auth check above is sufficient

        await ctx.db.patch(args.id, {
            ...(args.caption && { caption: args.caption }),
            ...(args.imageStorageId && { imageStorageId: args.imageStorageId }),
            ...(args.imagePrompt && { imagePrompt: args.imagePrompt }),
            ...(args.model && { model: args.model }),
            ...(args.imageModel && { imageModel: args.imageModel }),
            ...(args.status && { status: args.status }),
            ...(args.pendingImageModels !== undefined && { pendingImageModels: args.pendingImageModels }),
            ...(args.totalImageModels !== undefined && { totalImageModels: args.totalImageModels }),
            updatedAt: Date.now(),
        });
    },
});

// Remove a model from pending list (called when image generation completes)
export const removeFromPending = mutation({
    args: {
        id: v.id("generated_posts"),
        model: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const post = await ctx.db.get(args.id);
        if (!post) return;
        
        const pending = post.pendingImageModels?.filter(m => m !== args.model) ?? [];
        await ctx.db.patch(args.id, { 
            pendingImageModels: pending,
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

        // If post has a project, verify user owns it
        if (post.projectId) {
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
        }
        // For standalone posts (no projectId), auth check above is sufficient

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

        // If post has a project, verify user owns it
        if (post.projectId) {
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
        }
        // For standalone posts (no projectId), auth check above is sufficient

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

// Delete a generated post (hard delete - use softDelete for trash)
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

        // If post has a project, verify user owns it
        if (post.projectId) {
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
        }
        // For standalone posts (no projectId), auth check above is sufficient

        // Delete associated generated images
        const images = await ctx.db
            .query("generated_images")
            .withIndex("by_generated_post_id", (q) => q.eq("generatedPostId", args.id))
            .collect();
        
        for (const img of images) {
            await ctx.db.delete(img._id);
        }

        // Delete associated history
        const history = await ctx.db
            .query("generation_history")
            .withIndex("by_generated_post_id", (q) => q.eq("generatedPostId", args.id))
            .collect();
        
        for (const h of history) {
            await ctx.db.delete(h._id);
        }

        // Delete associated chat messages
        const messages = await ctx.db
            .query("chat_messages")
            .withIndex("by_generated_post_id", (q) => q.eq("generatedPostId", args.id))
            .collect();
        
        for (const m of messages) {
            await ctx.db.delete(m._id);
        }

        await ctx.db.delete(args.id);
    },
});

// ============================================================================
// Gallery & History Queries
// ============================================================================

// List all posts for current user (not deleted)
export const listByUser = query({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return [];
        }

        const limit = args.limit ?? 50;

        // Get posts by userId (standalone posts)
        const standalonePosts = await ctx.db
            .query("generated_posts")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .order("desc")
            .take(limit);

        // Get posts via projects
        const userProjects = await ctx.db
            .query("projects")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .collect();

        const projectPostsPromises = userProjects.map((project) =>
            ctx.db
                .query("generated_posts")
                .withIndex("by_project_id", (q) => q.eq("projectId", project._id))
                .order("desc")
                .take(limit)
        );
        const projectPostsArrays = await Promise.all(projectPostsPromises);
        const projectPosts = projectPostsArrays.flat();

        // Combine and sort by createdAt desc, filter out deleted
        const allPosts = [...standalonePosts, ...projectPosts]
            .filter((post) => !post.deletedAt)
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, limit);

        // Resolve image URLs and get first generated image for each
        return Promise.all(
            allPosts.map(async (post) => {
                let imageUrl: string | null = null;
                if (post.imageStorageId) {
                    imageUrl = await ctx.storage.getUrl(post.imageStorageId);
                }

                // Get first generated image for this post
                const images = await ctx.db
                    .query("generated_images")
                    .withIndex("by_generated_post_id", (q) => q.eq("generatedPostId", post._id))
                    .take(1);
                
                let firstImageUrl: string | null = null;
                const firstImage = images[0];
                if (firstImage) {
                    firstImageUrl = await ctx.storage.getUrl(firstImage.storageId);
                }

                return {
                    ...post,
                    imageUrl: firstImageUrl ?? imageUrl,
                };
            })
        );
    },
});

// Get post with all images and history
export const getWithHistory = query({
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

        // Verify user has access
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return null;
        }

        // Check ownership via userId or projectId
        let hasAccess = post.userId === user._id;
        if (!hasAccess && post.projectId) {
            const project = await ctx.db.get(post.projectId);
            hasAccess = project?.userId === user._id;
        }

        if (!hasAccess) {
            return null;
        }

        // Get all generated images
        const images = await ctx.db
            .query("generated_images")
            .withIndex("by_generated_post_id", (q) => q.eq("generatedPostId", args.id))
            .collect();

        const imagesWithUrls = await Promise.all(
            images.map(async (img) => ({
                ...img,
                url: await ctx.storage.getUrl(img.storageId),
            }))
        );

        // Get chat messages (history)
        const messages = await ctx.db
            .query("chat_messages")
            .withIndex("by_generated_post_id", (q) => q.eq("generatedPostId", args.id))
            .order("asc")
            .collect();

        // Resolve main image URL
        let imageUrl: string | null = null;
        if (post.imageStorageId) {
            imageUrl = await ctx.storage.getUrl(post.imageStorageId);
        }

        return {
            ...post,
            imageUrl,
            images: imagesWithUrls,
            messages,
        };
    },
});

// Soft delete (move to trash)
export const softDelete = mutation({
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

        // Verify user has access
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

        // Check ownership
        let hasAccess = post.userId === user._id;
        if (!hasAccess && post.projectId) {
            const project = await ctx.db.get(post.projectId);
            hasAccess = project?.userId === user._id;
        }

        if (!hasAccess) {
            throw new Error("Not authorized");
        }

        await ctx.db.patch(args.id, {
            deletedAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

// Restore from trash
export const restore = mutation({
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

        // Verify user has access
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

        // Check ownership
        let hasAccess = post.userId === user._id;
        if (!hasAccess && post.projectId) {
            const project = await ctx.db.get(post.projectId);
            hasAccess = project?.userId === user._id;
        }

        if (!hasAccess) {
            throw new Error("Not authorized");
        }

        await ctx.db.patch(args.id, {
            deletedAt: undefined,
            updatedAt: Date.now(),
        });
    },
});

// List deleted posts (trash)
export const listDeleted = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return [];
        }

        // Get deleted posts by userId
        const standalonePosts = await ctx.db
            .query("generated_posts")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .collect();

        // Get deleted posts via projects
        const userProjects = await ctx.db
            .query("projects")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .collect();

        const projectPostsPromises = userProjects.map((project) =>
            ctx.db
                .query("generated_posts")
                .withIndex("by_project_id", (q) => q.eq("projectId", project._id))
                .collect()
        );
        const projectPostsArrays = await Promise.all(projectPostsPromises);
        const projectPosts = projectPostsArrays.flat();

        // Filter only deleted, sort by deletedAt desc
        const deletedPosts = [...standalonePosts, ...projectPosts]
            .filter((post) => post.deletedAt)
            .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));

        // Resolve image URLs
        return Promise.all(
            deletedPosts.map(async (post) => {
                let imageUrl: string | null = null;
                if (post.imageStorageId) {
                    imageUrl = await ctx.storage.getUrl(post.imageStorageId);
                }

                // Get first generated image
                const images = await ctx.db
                    .query("generated_images")
                    .withIndex("by_generated_post_id", (q) => q.eq("generatedPostId", post._id))
                    .take(1);
                
                let firstImageUrl: string | null = null;
                const firstImage = images[0];
                if (firstImage) {
                    firstImageUrl = await ctx.storage.getUrl(firstImage.storageId);
                }

                return {
                    ...post,
                    imageUrl: firstImageUrl ?? imageUrl,
                };
            })
        );
    },
});

// Permanent delete from trash
export const permanentDelete = mutation({
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

        // Must be soft-deleted first
        if (!post.deletedAt) {
            throw new Error("Post must be in trash to permanently delete");
        }

        // Verify user has access
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

        // Check ownership
        let hasAccess = post.userId === user._id;
        if (!hasAccess && post.projectId) {
            const project = await ctx.db.get(post.projectId);
            hasAccess = project?.userId === user._id;
        }

        if (!hasAccess) {
            throw new Error("Not authorized");
        }

        // Delete all associated data
        const images = await ctx.db
            .query("generated_images")
            .withIndex("by_generated_post_id", (q) => q.eq("generatedPostId", args.id))
            .collect();
        
        for (const img of images) {
            await ctx.storage.delete(img.storageId);
            await ctx.db.delete(img._id);
        }

        const history = await ctx.db
            .query("generation_history")
            .withIndex("by_generated_post_id", (q) => q.eq("generatedPostId", args.id))
            .collect();
        
        for (const h of history) {
            if (h.imageStorageId) {
                await ctx.storage.delete(h.imageStorageId);
            }
            await ctx.db.delete(h._id);
        }

        const messages = await ctx.db
            .query("chat_messages")
            .withIndex("by_generated_post_id", (q) => q.eq("generatedPostId", args.id))
            .collect();
        
        for (const m of messages) {
            await ctx.db.delete(m._id);
        }

        // Delete main image storage
        if (post.imageStorageId) {
            await ctx.storage.delete(post.imageStorageId);
        }

        await ctx.db.delete(args.id);
    },
});

// Search posts by prompt
export const search = query({
    args: {
        query: v.string(),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return [];
        }

        const searchTerm = args.query.toLowerCase();
        const limit = args.limit ?? 20;

        // Get all user's posts (we'll filter in memory for now)
        // In production, you'd use a proper search index
        const standalonePosts = await ctx.db
            .query("generated_posts")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .collect();

        const userProjects = await ctx.db
            .query("projects")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .collect();

        const projectPostsPromises = userProjects.map((project) =>
            ctx.db
                .query("generated_posts")
                .withIndex("by_project_id", (q) => q.eq("projectId", project._id))
                .collect()
        );
        const projectPostsArrays = await Promise.all(projectPostsPromises);
        const projectPosts = projectPostsArrays.flat();

        // Filter by search term in caption or imagePrompt, exclude deleted
        const allPosts = [...standalonePosts, ...projectPosts]
            .filter((post) => !post.deletedAt)
            .filter((post) => {
                const captionMatch = post.caption?.toLowerCase().includes(searchTerm);
                const promptMatch = post.imagePrompt?.toLowerCase().includes(searchTerm);
                return captionMatch || promptMatch;
            })
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, limit);

        // Resolve image URLs
        return Promise.all(
            allPosts.map(async (post) => {
                const images = await ctx.db
                    .query("generated_images")
                    .withIndex("by_generated_post_id", (q) => q.eq("generatedPostId", post._id))
                    .take(1);
                
                let imageUrl: string | null = null;
                const firstImage = images[0];
                if (firstImage) {
                    imageUrl = await ctx.storage.getUrl(firstImage.storageId);
                } else if (post.imageStorageId) {
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
