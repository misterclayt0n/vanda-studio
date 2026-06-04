"use client";

import { z } from "zod";

type ToolCardProps = {
  status: "inProgress" | "executing" | "complete" | string;
  result?: string;
  title: string;
  tone?: "post" | "stats" | "summary";
};

function parseResult(result?: string): any | null {
  if (!result) return null;
  try {
    return JSON.parse(result);
  } catch {
    return null;
  }
}

function formatNumber(value: unknown) {
  if (typeof value !== "number") return "n/a";
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
}

function formatPct(value: unknown) {
  if (typeof value !== "number") return "n/a";
  return `${(value * 100).toFixed(2)}%`;
}

function formatDate(value: unknown) {
  if (typeof value !== "number" || !value) return "unsynced date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(value);
}

function ModeBadge({ mode }: { mode?: string }) {
  return <span className={`vanda-tool-badge ${mode === "live" ? "live" : "demo"}`}>{mode === "live" ? "live convex" : "demo"}</span>;
}

function MiniBars({ posts }: { posts: any[] }) {
  const max = Math.max(...posts.map((post) => Number(post.engagementScore ?? 0)), 0.001);
  return (
    <div className="mini-bars">
      {posts.slice(0, 5).map((post, index) => {
        const score = Number(post.engagementScore ?? 0);
        return (
          <div className="mini-bar-row" key={post.id ?? index}>
            <span>{(post.caption ?? "Instagram post").slice(0, 34)}</span>
            <div className="mini-bar-track">
              <div className="mini-bar-fill" style={{ width: `${Math.max(8, (score / max) * 100)}%` }} />
            </div>
            <b>{formatPct(score)}</b>
          </div>
        );
      })}
    </div>
  );
}

function StatsRadial({ stats }: { stats: any }) {
  const engagement = typeof stats?.avgEngagement === "number" ? Math.min(100, stats.avgEngagement * 10000) : 0;
  return (
    <div className="stats-visual">
      <div className="radial" style={{ background: `conic-gradient(#0f7a6b ${engagement}%, #e8e0d4 0)` }}>
        <div>{formatPct(stats?.avgEngagement)}</div>
      </div>
      <div className="stat-stack">
        <span><b>{formatNumber(stats?.followersCount)}</b> followers</span>
        <span><b>{formatNumber(stats?.postsCount)}</b> posts</span>
        <span><b>{formatNumber(stats?.followersDelta)}</b> follower delta</span>
      </div>
    </div>
  );
}

function MetricStrip({ post, stats }: { post: any; stats: any }) {
  const metrics = stats
    ? [
        ["Followers", formatNumber(stats.followersCount)],
        ["Reach", formatNumber(stats.reach)],
        ["Posts", formatNumber(stats.postsCount)],
      ]
    : [
        ["Likes", formatNumber(post?.likeCount)],
        ["Comments", formatNumber(post?.commentsCount)],
        ["Reach", formatNumber(post?.reach)],
      ];

  return (
    <div className="metric-strip">
      {metrics.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </div>
  );
}

export function VandaToolCard({ status, result, title, tone = "post" }: ToolCardProps) {
  const data = parseResult(result);

  if (!data || status !== "complete") {
    return (
      <div className={`vanda-tool-card loading ${tone}`}>
        <div className="scanline" />
        <div>
          <strong>{title}</strong>
          <span>Reading Convex and shaping a response...</span>
        </div>
      </div>
    );
  }

  const post = data.latestPost ?? data.topPost ?? data.posts?.[0] ?? null;
  const posts = Array.isArray(data.posts) ? data.posts : data.topPost ? [data.topPost] : [];
  const modeText = data.mode === "live" ? "live Convex data" : "demo fallback data";

  return (
    <div className={`vanda-tool-card ${tone}`}>
      <div className="tool-head">
        <div>
          <strong>{title}</strong>
          <p>{modeText}</p>
        </div>
        <ModeBadge mode={data.mode} />
      </div>

      {data.project ? <p className="tool-project">{data.project.name}{data.project.instagramHandle ? ` · @${data.project.instagramHandle}` : ""}</p> : null}

      {data.stats ? <StatsRadial stats={data.stats} /> : null}

      <MetricStrip post={post} stats={data.stats} />

      {posts.length > 0 ? <MiniBars posts={posts} /> : null}

      {post ? (
        <a className="post-preview" href={post.permalink} target="_blank" rel="noreferrer">
          <span>{post.mediaType} · {formatDate(post.publishedAt)}</span>
          <b>{post.caption ?? "Imported Instagram post"}</b>
          <small>{formatNumber(post.likeCount)} likes · {formatNumber(post.commentsCount)} comments · {formatPct(post.engagementScore)}</small>
        </a>
      ) : null}

      {!post && !data.stats ? <p className="empty-note">No imported Instagram posts available for this project yet.</p> : null}
    </div>
  );
}

const optionalProjectArgs = z.object({ projectId: z.string().optional() });

export const vandaToolRenderers = [
  {
    name: "fetchLatestInstagramPost",
    args: optionalProjectArgs,
    render: (props: any) => <VandaToolCard {...props} title="Latest post" tone="post" />,
  },
  {
    name: "fetchBestPerformingInstagramPosts",
    args: optionalProjectArgs.extend({ limit: z.number().optional() }),
    render: (props: any) => <VandaToolCard {...props} title="Top posts" tone="post" />,
  },
  {
    name: "fetchCurrentInstagramStats",
    args: optionalProjectArgs,
    render: (props: any) => <VandaToolCard {...props} title="Account stats" tone="stats" />,
  },
  {
    name: "summarizeRecentInstagramPerformance",
    args: optionalProjectArgs,
    render: (props: any) => <VandaToolCard {...props} title="Performance summary" tone="summary" />,
  },
];
