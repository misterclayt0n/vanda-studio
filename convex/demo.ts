"use node";

import { ApifyClient } from "apify-client";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { callLLM, parseJSONResponse, generateImage, MODELS } from "./ai/llm";
import {
    POST_GENERATION_SYSTEM_PROMPT,
    POST_GENERATION_USER_PROMPT,
    PostGenerationResponse,
    IMAGE_GENERATION_PROMPT,
    ImageStyleType,
    BRAND_ANALYSIS_SYSTEM_PROMPT,
    BRAND_ANALYSIS_USER_PROMPT,
} from "./ai/prompts";

const DEFAULT_ACTOR_ID = "shu8hvrXbJbY3Eb9W";

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type RawInstagramItem = Record<string, any>;

interface DemoPost {
    caption: string;
    mediaUrl: string;
    likeCount?: number;
    commentsCount?: number;
    timestamp: string;
    mediaType: string;
}

interface DemoResult {
    success: boolean;
    generatedCaption: string;
    generatedImageBase64?: string;
    generatedImageMimeType?: string;
    reasoning: string;
    sourcePosts: DemoPost[];
    brandAnalysis?: {
        brandVoice: string;
        targetAudience: string;
        contentPillars: string[];
    };
    error?: string;
}

// Demo generation action - generates a post from an Instagram handle
export const generateDemo = action({
    args: {
        instagramHandle: v.string(),
        additionalContext: v.optional(v.string()),
        imageStyle: v.optional(v.union(
            v.literal("realistic"),
            v.literal("illustrative"),
            v.literal("minimalist"),
            v.literal("artistic")
        )),
        fingerprint: v.optional(v.string()), // For rate limiting anonymous users
    },
    handler: async (ctx, args): Promise<DemoResult> => {
        // Check if user is authenticated
        const identity = await ctx.auth.getUserIdentity();
        const isAuthenticated = !!identity;

        // Rate limit anonymous users
        if (!isAuthenticated && args.fingerprint) {
            const usage = await ctx.runQuery(api.demoUsage.checkDemoUsage, {
                fingerprint: args.fingerprint,
            });

            if (!usage.canUse) {
                return {
                    success: false,
                    generatedCaption: "",
                    reasoning: "",
                    sourcePosts: [],
                    error: "Voce ja usou sua demonstracao gratuita. Crie uma conta para continuar!",
                };
            }
        }

        const token = process.env.APIFY_API_TOKEN ?? process.env.APIFY_TOKEN;
        if (!token) {
            return {
                success: false,
                generatedCaption: "",
                reasoning: "",
                sourcePosts: [],
                error: "Servico de busca indisponivel no momento.",
            };
        }

        // Normalize handle
        let handle = args.instagramHandle.trim();
        if (handle.startsWith("@")) {
            handle = handle.slice(1);
        }
        if (handle.includes("instagram.com/")) {
            const match = handle.match(/instagram\.com\/([^/?]+)/);
            if (match) {
                handle = match[1];
            }
        }

        const instagramUrl = `https://www.instagram.com/${handle}/`;

        try {
            // 1. Fetch Instagram posts
            const client = new ApifyClient({ token });
            const actorId = process.env.APIFY_INSTAGRAM_ACTOR_ID ?? DEFAULT_ACTOR_ID;

            const run = await client.actor(actorId).call({
                directUrls: [instagramUrl],
                resultsType: "posts",
                resultsLimit: 5, // Only fetch 5 posts for demo
                addParentData: true,
                searchType: "user",
            });

            if (!run.defaultDatasetId) {
                return {
                    success: false,
                    generatedCaption: "",
                    reasoning: "",
                    sourcePosts: [],
                    error: "Nao foi possivel acessar o perfil. Verifique se o @ esta correto.",
                };
            }

            const { items } = await client.dataset(run.defaultDatasetId).listItems({ clean: true });
            const datasetItems = (items as RawInstagramItem[]) ?? [];

            if (datasetItems.length === 0) {
                return {
                    success: false,
                    generatedCaption: "",
                    reasoning: "",
                    sourcePosts: [],
                    error: "Perfil nao encontrado ou sem posts publicos.",
                };
            }

            // 2. Extract posts
            const posts = extractPosts(datasetItems).slice(0, 3);
            if (posts.length < 1) {
                return {
                    success: false,
                    generatedCaption: "",
                    reasoning: "",
                    sourcePosts: [],
                    error: "Nenhum post encontrado no perfil.",
                };
            }

            // 3. Quick brand analysis
            const profileData = extractProfileData(datasetItems, handle);
            const brandAnalysisPrompt = BRAND_ANALYSIS_USER_PROMPT({
                handle,
                bio: profileData.bio,
                followersCount: profileData.followersCount,
                postsCount: profileData.postsCount,
                posts: posts.map((p) => ({
                    caption: p.caption,
                    likeCount: p.likeCount,
                    commentsCount: p.commentsCount,
                    mediaType: p.mediaType,
                    timestamp: p.timestamp,
                })),
            });

            const brandResponse = await callLLM(
                [
                    { role: "system", content: BRAND_ANALYSIS_SYSTEM_PROMPT },
                    { role: "user", content: brandAnalysisPrompt },
                ],
                {
                    model: MODELS.GEMINI_2_5_FLASH,
                    temperature: 0.7,
                    maxTokens: 2048,
                    jsonMode: true,
                }
            );

            const brandAnalysis = parseJSONResponse<{
                brandVoice: { current: string; recommended: string; tone: string[] };
                contentPillars: Array<{ name: string; description: string }>;
                targetAudience: { current: string; recommended: string };
            }>(brandResponse.content);

            // 4. Generate caption
            const context = {
                brandVoice: {
                    recommended: brandAnalysis.brandVoice.recommended,
                    tone: brandAnalysis.brandVoice.tone,
                },
                targetAudience: brandAnalysis.targetAudience.recommended,
                contentPillars: brandAnalysis.contentPillars.map((p) => ({
                    name: p.name,
                    description: p.description,
                })),
                analyzedPosts: posts.map((p) => ({
                    caption: p.caption || "",
                    strengths: ["Conteudo original da marca"],
                    toneAnalysis: "Tom consistente com a marca",
                })),
                additionalContext: args.additionalContext,
            };

            const captionPrompt = POST_GENERATION_USER_PROMPT(context);
            const captionResponse = await callLLM(
                [
                    { role: "system", content: POST_GENERATION_SYSTEM_PROMPT },
                    { role: "user", content: captionPrompt },
                ],
                {
                    model: MODELS.GPT_4_1,
                    temperature: 0.8,
                    maxTokens: 1024,
                }
            );

            const generated = parseJSONResponse<PostGenerationResponse>(captionResponse.content);

            // 5. Generate image with reference images
            const referenceImages = posts
                .filter((p) => p.mediaUrl && !p.mediaType.toLowerCase().includes("video"))
                .map((p) => ({ url: p.mediaUrl }));

            const imagePrompt = IMAGE_GENERATION_PROMPT({
                brandName: handle,
                visualStyle: "Moderno e profissional",
                caption: generated.caption,
                additionalContext: args.additionalContext,
                imageStyle: args.imageStyle as ImageStyleType | undefined,
                hasReferenceImages: referenceImages.length > 0,
            });

            let generatedImageBase64: string | undefined;
            let generatedImageMimeType: string | undefined;

            try {
                const imageResult = await generateImage(imagePrompt, {
                    referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
                });
                generatedImageBase64 = imageResult.imageBase64;
                generatedImageMimeType = imageResult.mimeType;
            } catch (imageError) {
                console.error("Image generation failed:", imageError);
            }

            // Record demo usage for anonymous users
            if (!isAuthenticated && args.fingerprint) {
                await ctx.runMutation(api.demoUsage.recordDemoUsage, {
                    fingerprint: args.fingerprint,
                    instagramHandle: handle,
                });
            }

            return {
                success: true,
                generatedCaption: generated.caption,
                generatedImageBase64,
                generatedImageMimeType,
                reasoning: generated.reasoning,
                sourcePosts: posts,
                brandAnalysis: {
                    brandVoice: brandAnalysis.brandVoice.recommended,
                    targetAudience: brandAnalysis.targetAudience.recommended,
                    contentPillars: brandAnalysis.contentPillars.map((p) => p.name),
                },
            };
        } catch (error) {
            console.error("Demo generation error:", error);
            return {
                success: false,
                generatedCaption: "",
                reasoning: "",
                sourcePosts: [],
                error: error instanceof Error ? error.message : "Erro ao gerar post de demonstracao.",
            };
        }
    },
});

// Helper: extract posts from Apify data
function extractPosts(items: RawInstagramItem[]): DemoPost[] {
    const posts: DemoPost[] = [];

    for (const item of items) {
        const mediaType = (item.type || item.mediaType || "IMAGE").toUpperCase();
        const isVideo = mediaType.includes("VIDEO") || mediaType === "REEL";

        // Skip videos for now
        if (isVideo) continue;

        const mediaUrl = item.displayUrl || item.imageUrl || item.thumbnailUrl;
        if (!mediaUrl) continue;

        posts.push({
            caption: item.caption || item.description || "",
            mediaUrl,
            likeCount: item.likesCount || item.likeCount,
            commentsCount: item.commentsCount || item.commentCount,
            timestamp: normalizeTimestamp(item.timestamp || item.takenAt),
            mediaType,
        });
    }

    return posts;
}

// Helper: extract profile data
function extractProfileData(items: RawInstagramItem[], handle: string) {
    const first = items[0] || {};
    const owner = first.ownerUsername ? first : (first.owner || {});

    return {
        handle,
        bio: owner.biography || first.ownerBiography || "",
        followersCount: owner.followersCount || owner.edge_followed_by?.count,
        postsCount: owner.postsCount || owner.edge_owner_to_timeline_media?.count,
    };
}

// Helper: normalize timestamp
function normalizeTimestamp(ts: string | number | undefined): string {
    if (!ts) return new Date().toISOString();
    if (typeof ts === "number") {
        // Unix timestamp (seconds or milliseconds)
        const msTs = ts < 1e12 ? ts * 1000 : ts;
        return new Date(msTs).toISOString();
    }
    return ts;
}
