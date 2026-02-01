import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Check for missed posts every 5 minutes
crons.interval(
    "mark missed posts",
    { minutes: 5 },
    internal.scheduledPosts.markMissedPosts
);

// Sync pending calendar events to Google Calendar every 2 minutes
crons.interval(
    "sync pending calendar events",
    { minutes: 2 },
    internal.googleCalendar.syncPendingEvents
);

export default crons;
