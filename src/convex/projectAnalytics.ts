import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

function rate(post: Doc<"social_posts">): number {
  const interactions = post.totalInteractions ?? (post.likeCount ?? 0) + (post.commentsCount ?? 0) + (post.saved ?? 0) + (post.shares ?? 0);
  return post.reach && post.reach > 0 ? interactions / post.reach : (post.engagementScore ?? 0);
}
function perfLabel(r: number, sorted: number[]) {
  if (sorted.length < 3) return "Estável";
  const below = sorted.filter((x) => x <= r).length / sorted.length;
  return below >= 0.75 ? "Em alta" : below >= 0.4 ? "Estável" : "Abaixo";
}
async function owned(ctx: any, projectId: any, subject: string) {
  const user = await ctx.db.query("users").withIndex("by_clerk_id", (q: any) => q.eq("clerkId", subject)).unique();
  const project = await ctx.db.get(projectId);
  if (!user || !project || project.userId !== user._id) return null;
  return { user, project };
}

export const overview = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const auth = await owned(ctx, args.projectId, identity.subject);
    if (!auth) return null;
    const posts = await ctx.db.query("social_posts").withIndex("by_project_published", (q) => q.eq("projectId", args.projectId)).order("desc").take(80);
    const generated = await ctx.db.query("generated_posts").withIndex("by_project_id", (q) => q.eq("projectId", args.projectId)).collect();
    const accountSnaps = await ctx.db.query("account_metric_snapshots").withIndex("by_project_captured", (q) => q.eq("projectId", args.projectId)).order("desc").take(30);
    const rates = posts.map(rate).sort((a,b)=>a-b);
    const best = [...posts].sort((a,b)=>rate(b)-rate(a))[0] ?? null;
    const worst = [...posts].sort((a,b)=>rate(a)-rate(b))[0] ?? null;
    const upcoming = generated.filter((p:any)=>p.scheduledFor && p.scheduledFor >= Date.now() && p.schedulingStatus === "scheduled").slice(0,5);
    return {
      stats: {
        importedPosts: posts.length,
        scheduledCount: upcoming.length,
        analyzedCount: posts.filter((p)=>p.intelligence).length,
        medianEngagement: rates.length ? rates[Math.floor(rates.length/2)] : 0,
        totalReach: posts.reduce((s,p)=>s+(p.reach??0),0),
        totalInteractions: posts.reduce((s,p)=>s+(p.totalInteractions ?? (p.likeCount??0)+(p.commentsCount??0)+(p.saved??0)+(p.shares??0)),0),
      },
      followers: { current: accountSnaps[0]?.followersCount ?? auth.project.followersCount ?? null, delta: accountSnaps[0]?.followersCount !== undefined && accountSnaps[1]?.followersCount !== undefined ? accountSnaps[0].followersCount - accountSnaps[1].followersCount : null, series: accountSnaps.slice().reverse().map((s)=>({ date: s.capturedAt, value: s.followersCount ?? 0 })) },
      engagementSeries: posts.slice().reverse().map((p)=>({ date: p.publishedAt, value: rate(p) })),
      bestPost: best ? { ...best, performanceLabel: perfLabel(rate(best), rates), engagementRate: rate(best) } : null,
      worstPost: worst ? { ...worst, performanceLabel: perfLabel(rate(worst), rates), engagementRate: rate(worst) } : null,
      upcoming,
    };
  }
});

export const contentLibrary = query({
  args: { projectId: v.id("projects"), search: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const auth = await owned(ctx, args.projectId, identity.subject);
    if (!auth) return null;
    const all = await ctx.db.query("social_posts").withIndex("by_project_published", (q) => q.eq("projectId", args.projectId)).order("desc").take(Math.min(100, args.limit ?? 50));
    const q = (args.search ?? "").trim().toLowerCase();
    const posts = all.filter((p)=>!q || (p.caption ?? "").toLowerCase().includes(q));
    const rates = all.map(rate).sort((a,b)=>a-b);
    return { stats: { importedCount: all.length, analyzedCount: all.filter(p=>p.intelligence).length, medianEngagement: rates.length ? rates[Math.floor(rates.length/2)] : 0, commentRate: all.length ? all.reduce((s,p)=>s+(p.commentsCount??0),0)/Math.max(1, all.reduce((s,p)=>s+(p.reach??0),0)) : 0 }, posts: posts.map((p)=>({ ...p, engagementRate: rate(p), performanceLabel: perfLabel(rate(p), rates), hasVandaAnalysis: Boolean(p.intelligence) })) };
  }
});

export const strategy = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const auth = await owned(ctx, args.projectId, identity.subject);
    if (!auth) return null;
    const latest = await ctx.db.query("project_strategy_snapshots").withIndex("by_project_created", (q) => q.eq("projectId", args.projectId)).order("desc").first();
    const analyzedCount = await ctx.db.query("social_posts").withIndex("by_project_published", (q) => q.eq("projectId", args.projectId)).collect();
    return { latest, importedPostCount: analyzedCount.length, analyzedPostCount: analyzedCount.filter((p)=>p.intelligence).length };
  }
});

export const createStrategySnapshotInternal = internalMutation({
  args: {
    projectId: v.id("projects"), sourcePostIds: v.array(v.id("social_posts")), analyzedFrom: v.number(), analyzedTo: v.number(), postCount: v.number(), summary: v.string(), confidence: v.string(), audienceSignals: v.array(v.string()), contentPillars: v.array(v.string()), workingThemes: v.array(v.object({ label: v.string(), evidence: v.string(), engagementRate: v.optional(v.number()) })), visualDirection: v.array(v.string()), avoidList: v.array(v.string()), suggestedExperiments: v.array(v.object({ title: v.string(), expectedImpact: v.string() })), next7DaysPlan: v.array(v.object({ dateLabel: v.string(), idea: v.string(), format: v.string() })),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Projeto não encontrado");
    await ctx.db.insert("project_strategy_snapshots", { userId: project.userId, createdAt: Date.now(), ...args });
  }
});
