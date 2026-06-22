import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Observe runs as a continuous background loop, per the conceptual pipeline;
// consolidate folds the freshly observed signals into memory on a slower cadence.
crons.interval("observe accounts", { minutes: 30 }, internal.observe.observeAllAccounts, {});
crons.interval(
  "consolidate accounts",
  { hours: 1 },
  internal.consolidate.consolidateAllAccounts,
  {},
);

export default crons;
