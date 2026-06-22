import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // convex-test must be inlined so its `import.meta.glob` of Convex modules resolves.
    server: { deps: { inline: ["convex-test"] } },
  },
});
