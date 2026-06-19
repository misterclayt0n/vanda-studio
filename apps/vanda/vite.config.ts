import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

const rootEnvDir = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, rootEnvDir, "");
  for (const [key, value] of Object.entries(rootEnv)) {
    process.env[key] ??= value;
  }

  return {
    envDir: rootEnvDir,
    envPrefix: ["VITE_", "PUBLIC_"],
    server: {
      port: 3000,
      allowedHosts: [".trycloudflare.com"],
    },
    plugins: [tailwindcss(), tanstackStart(), nitro(), viteReact()],
  };
});
