import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

export const fetchProfile = action({
    args: {
        projectId: v.id("projects"),
        instagramUrl: v.string(),
    },
    handler: async (ctx, args) => {
        // TODO: Implement actual Instagram fetching logic here.
        // For now, we will simulate a fetch with mock data.

        console.log(`Fetching Instagram profile for ${args.instagramUrl} (Project: ${args.projectId})`);

        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const mockProfile = {
            username: "mock_brand",
            followers: 12500,
            following: 300,
            posts: 150,
            bio: "Official Instagram of Mock Brand. We make cool stuff.",
            profilePictureUrl: "https://github.com/shadcn.png", // Placeholder
        };

        const mockPosts = Array.from({ length: 12 }).map((_, i) => ({
            instagramId: `post_${Date.now()}_${i}`,
            caption: `This is post number ${i + 1}. #mock #brand`,
            mediaUrl: `https://picsum.photos/seed/${i}/400/400`,
            mediaType: "IMAGE",
            permalink: `https://instagram.com/p/mock_${i}`,
            timestamp: new Date().toISOString(),
            likeCount: Math.floor(Math.random() * 1000),
            commentsCount: Math.floor(Math.random() * 50),
        }));

        // Update project with profile info
        // Note: We need a mutation to update the project. 
        // We can't call mutations directly from actions, we must use ctx.runMutation.
        // However, we haven't defined an `update` mutation in projects.ts yet.
        // For this step, we'll just log the data.

        console.log("Fetched Profile:", mockProfile);
        console.log("Fetched Posts:", mockPosts.length);

        return {
            profile: mockProfile,
            posts: mockPosts,
        };
    },
});
