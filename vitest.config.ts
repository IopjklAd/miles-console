import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

/**
 * Standalone Vitest configuration (kept separate from vite.config.ts so the
 * dev-server/HMR configuration is untouched).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    restoreMocks: true,
  },
});
