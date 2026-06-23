import autumn from "@useautumn/convex/convex.config";
import workflow from "@convex-dev/workflow/convex.config.js";
import { defineApp } from "convex/server";

// The create stage runs as a durable workflow: plan the composition → generate
// N images (the slow/flaky step that earns durability) → compose. Autumn stays
// registered for billing (mirrors the previous convex/convex.config.ts).
const app = defineApp();
app.use(autumn);
app.use(workflow);

export default app;
