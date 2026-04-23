import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Check for missed posts every 5 minutes
crons.interval(
    "mark missed posts",
    { minutes: 5 },
    internal.scheduledPosts.markMissedPosts
);

crons.interval(
    "publish instagram posts",
    { minutes: 5 },
    internal.instagramGraphActions.publishDueScheduledPostsInternal,
    {}
);

export default crons;
