"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { callLLM, parseJSONResponse } from "./llm";
import {
    CREATIVE_ANGLES_SYSTEM_PROMPT,
    CREATIVE_ANGLES_USER_PROMPT,
    CreativeAnglesResponse,
    CreativeAnglesBriefInput,
    PostType,
} from "./prompts";

// Hash function for brief to check cache
function hashBrief(brief: {
    postType: string;
    contentPillar?: string;
    customTopic?: string;
    referenceText?: string;
    additionalContext?: string;
}): string {
    const str = JSON.stringify({
        postType: brief.postType,
        contentPillar: brief.contentPillar || '',
        customTopic: brief.customTopic || '',
        referenceText: brief.referenceText?.substring(0, 100) || '',
        additionalContext: brief.additionalContext?.substring(0, 100) || '',
    });
    // Simple hash
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
}

export const brainstormAngles = action({
    args: {
        projectId: v.id("projects"),
        brief: v.object({
            postType: v.string(),
            contentPillar: v.optional(v.string()),
            customTopic: v.optional(v.string()),
            toneOverride: v.optional(v.array(v.string())),
            referenceText: v.optional(v.string()),
            additionalContext: v.optional(v.string()),
        }),
    },
    handler: async (ctx, args): Promise<{
        angles: CreativeAnglesResponse["angles"];
        cached: boolean;
    }> => {
        // Get project
        const project = await ctx.runQuery(api.projects.get, { projectId: args.projectId });
        if (!project) {
            throw new Error("Projeto não encontrado");
        }

        // Get brand analysis
        const brandAnalysis = await ctx.runQuery(api.ai.analysisMutations.getLatestAnalysis, {
            projectId: args.projectId,
        });
        if (!brandAnalysis || brandAnalysis.status !== "completed") {
            throw new Error("Análise de marca não encontrada. Execute a análise primeiro.");
        }

        // Check cache
        const briefHash = hashBrief(args.brief);
        const cached = await ctx.runQuery(api.ai.creativeAnglesMutations.getByHash, {
            projectId: args.projectId,
            briefHash,
        });

        if (cached && cached.expiresAt > Date.now()) {
            return {
                angles: cached.angles,
                cached: true,
            };
        }

        // Get top performing posts for inspiration
        const posts = await ctx.runQuery(api.instagramPosts.listByProject, {
            projectId: args.projectId,
        });
        
        // Sort by engagement and take top 3
        const topPosts = posts
            .filter(p => p.caption && p.likeCount !== undefined)
            .sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
            .slice(0, 3)
            .map(p => ({
                caption: p.caption || '',
                engagement: p.likeCount || 0,
            }));

        // Build input for prompt
        const input: CreativeAnglesBriefInput = {
            brandName: project.name,
            brandVoice: {
                recommended: brandAnalysis.brandVoice?.recommended || '',
                tone: brandAnalysis.brandVoice?.tone || [],
            },
            targetAudience: brandAnalysis.targetAudience?.recommended || '',
            contentPillars: brandAnalysis.contentPillars || [],
            postType: args.brief.postType as PostType,
            selectedPillar: args.brief.contentPillar,
            customTopic: args.brief.customTopic,
            toneOverride: args.brief.toneOverride,
            referenceText: args.brief.referenceText,
            additionalContext: args.brief.additionalContext,
            topPosts,
        };

        // Call LLM
        const llmResponse = await callLLM(
            [
                { role: "system", content: CREATIVE_ANGLES_SYSTEM_PROMPT },
                { role: "user", content: CREATIVE_ANGLES_USER_PROMPT(input) },
            ],
            {
                model: "google/gemini-2.5-flash",
                temperature: 0.9, // Higher temperature for more creative variety
                jsonMode: true,
            }
        );

        const response = parseJSONResponse<CreativeAnglesResponse>(llmResponse.content);

        if (!response.angles || response.angles.length === 0) {
            throw new Error("Falha ao gerar ângulos criativos");
        }

        // Save to cache (expires in 1 hour)
        await ctx.runMutation(api.ai.creativeAnglesMutations.save, {
            projectId: args.projectId,
            briefHash,
            angles: response.angles,
            brief: args.brief,
            expiresAt: Date.now() + 60 * 60 * 1000,
        });

        // Consume quota
        await ctx.runMutation(api.billing.usage.consumePrompt, {});

        return {
            angles: response.angles,
            cached: false,
        };
    },
});
