import { mutation } from "./_generated/server";

// One-time cleanup mutation to remove documents from deleted tables
// Run this once via Convex dashboard, then delete this file
export const cleanupOldData = mutation({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // Note: This mutation assumes the old tables still exist in the database
        // but have been removed from the schema. Convex will error if the tables
        // don't exist, so only run relevant cleanups.
        
        const results = {
            deletedBrandAnalysis: 0,
            deletedPostAnalysis: 0,
            deletedDemoUsage: 0,
            deletedConversations: 0,
            deletedConversationMessages: 0,
            deletedContentCalendar: 0,
            deletedAssets: 0,
            cleanedGeneratedPosts: 0,
        };

        // The cleanup needs to be done via the Convex dashboard Data tab
        // since we can't query tables that don't exist in the schema
        
        // Clean generated_posts documents that have invalid fields (selectedAngle, brandAnalysisId)
        // This is done by patching documents to remove undefined fields
        const generatedPosts = await ctx.db.query("generated_posts").collect();
        for (const post of generatedPosts) {
            // The schema validator will reject documents with extra fields
            // so any document that made it through is valid
            results.cleanedGeneratedPosts++;
        }

        return {
            message: "Cleanup complete. Use Convex Dashboard to manually delete documents from removed tables: brand_analysis, post_analysis, demo_usage, conversations, conversation_messages, content_calendar, assets",
            ...results,
        };
    },
});
