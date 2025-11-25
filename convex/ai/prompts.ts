// Prompt templates for AI analysis

export const BRAND_ANALYSIS_SYSTEM_PROMPT = `You are a senior social media strategist and brand consultant specializing in Instagram marketing. Your role is to analyze Instagram profiles and provide actionable transformation strategies.

Your analysis must be:
1. ACTIONABLE - Every recommendation must be immediately implementable
2. SPECIFIC - Reference actual patterns you observe in the data
3. REASONED - Explain WHY each change will improve performance
4. CONSTRUCTIVE - Frame improvements positively while being honest

You will receive profile data and recent posts. Analyze them holistically to understand the brand's current state and provide strategic recommendations.

IMPORTANT: Respond ONLY with valid JSON matching the exact schema provided. No markdown, no explanations outside the JSON.`;

export const BRAND_ANALYSIS_USER_PROMPT = (data: {
    handle: string;
    bio: string | undefined;
    followersCount: number | undefined;
    postsCount: number | undefined;
    posts: Array<{
        caption: string | undefined;
        likeCount: number | undefined;
        commentsCount: number | undefined;
        mediaType: string;
        timestamp: string;
    }>;
}) => `Analyze this Instagram profile and provide a comprehensive brand transformation strategy.

## Profile Data
- Handle: @${data.handle}
- Bio: ${data.bio || "(no bio)"}
- Followers: ${data.followersCount?.toLocaleString() || "unknown"}
- Total Posts: ${data.postsCount || "unknown"}

## Recent Posts (${data.posts.length} posts)
${data.posts.map((post, i) => `
### Post ${i + 1}
- Type: ${post.mediaType}
- Date: ${post.timestamp}
- Likes: ${post.likeCount ?? "unknown"}
- Comments: ${post.commentsCount ?? "unknown"}
- Caption: "${post.caption || "(no caption)"}"
`).join("\n")}

## Required JSON Response Schema
{
  "brandVoice": {
    "current": "Description of current brand voice based on captions",
    "recommended": "Recommended brand voice direction",
    "reasoning": "Why this change will improve engagement",
    "tone": ["adjective1", "adjective2", "adjective3"]
  },
  "contentPillars": [
    {
      "name": "Pillar name",
      "description": "What this content pillar covers",
      "reasoning": "Why this pillar fits the brand"
    }
  ],
  "visualDirection": {
    "currentStyle": "Description of current visual style",
    "recommendedStyle": "Recommended visual direction",
    "reasoning": "Why this visual change will help"
  },
  "targetAudience": {
    "current": "Who the content currently appeals to",
    "recommended": "Ideal target audience",
    "reasoning": "Why targeting this audience makes sense"
  },
  "overallScore": 75,
  "strategySummary": "2-3 sentence summary of the key strategic recommendations"
}

Analyze thoroughly and respond with ONLY the JSON object.`;

export const POST_ANALYSIS_SYSTEM_PROMPT = `You are a senior content strategist reviewing Instagram posts like a code reviewer reviews pull requests. Your job is to provide specific, actionable feedback on each post's caption.

For each post, you will:
1. Rewrite the caption to maximize engagement
2. Explain your reasoning (like PR comments)
3. Score the original caption (0-100)
4. List specific improvements by category

Be specific. Reference the actual content. Explain your reasoning clearly.

IMPORTANT: Respond ONLY with valid JSON matching the exact schema provided. No markdown, no explanations outside the JSON.`;

export const POST_ANALYSIS_USER_PROMPT = (data: {
    brandContext: {
        handle: string;
        brandVoice: string;
        targetAudience: string;
        contentPillars: string[];
    };
    post: {
        caption: string | undefined;
        mediaType: string;
        likeCount: number | undefined;
        commentsCount: number | undefined;
        timestamp: string;
    };
}) => `Review this Instagram post and provide detailed feedback.

## Brand Context
- Handle: @${data.brandContext.handle}
- Target Voice: ${data.brandContext.brandVoice}
- Target Audience: ${data.brandContext.targetAudience}
- Content Pillars: ${data.brandContext.contentPillars.join(", ")}

## Post to Review
- Type: ${data.post.mediaType}
- Date: ${data.post.timestamp}
- Engagement: ${data.post.likeCount ?? 0} likes, ${data.post.commentsCount ?? 0} comments
- Current Caption: "${data.post.caption || "(no caption)"}"

## Required JSON Response Schema
{
  "suggestedCaption": "The rewritten caption that addresses all issues and maximizes engagement",
  "reasoning": "2-3 sentences explaining the key changes and why they improve the post",
  "score": 65,
  "improvements": [
    {
      "type": "hook",
      "issue": "What's wrong with the current approach",
      "suggestion": "Specific fix"
    },
    {
      "type": "cta",
      "issue": "Issue with call-to-action",
      "suggestion": "Better CTA approach"
    }
  ]
}

Valid improvement types: "hook", "cta", "hashtags", "tone", "length", "emoji", "formatting", "value"

Analyze and respond with ONLY the JSON object.`;

// Types for parsed responses
export interface BrandAnalysisResponse {
    brandVoice: {
        current: string;
        recommended: string;
        reasoning: string;
        tone: string[];
    };
    contentPillars: Array<{
        name: string;
        description: string;
        reasoning: string;
    }>;
    visualDirection: {
        currentStyle: string;
        recommendedStyle: string;
        reasoning: string;
    };
    targetAudience: {
        current: string;
        recommended: string;
        reasoning: string;
    };
    overallScore: number;
    strategySummary: string;
}

export interface PostAnalysisResponse {
    suggestedCaption: string;
    reasoning: string;
    score: number;
    improvements: Array<{
        type: string;
        issue: string;
        suggestion: string;
    }>;
}
