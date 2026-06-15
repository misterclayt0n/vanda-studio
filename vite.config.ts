import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
	envPrefix: ["VITE_", "PUBLIC_"],
	server: {
		port: 3000,
		allowedHosts: [".trycloudflare.com"],
	},
	plugins: [tanstackStart(), viteReact()],
});
