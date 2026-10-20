import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Vite config for the Xillow UI.
 *
 * In development the browser calls same-origin `/api/*` requests which Vite
 * proxies to the Express API. This keeps the browser talking to a single origin
 * in dev (no CORS needed) while `VITE_API_BASE` lets a production build point at
 * a separately hosted API.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: { url: "http://localhost/" },
    },
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
