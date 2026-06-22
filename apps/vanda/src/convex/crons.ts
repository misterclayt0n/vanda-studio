import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Observe runs as a continuous background loop, per the conceptual pipeline.
crons.interval("observe accounts", { minutes: 30 }, internal.observe.observeAllAccounts, {});

export default crons;
