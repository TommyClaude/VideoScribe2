/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed dev server port.
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Prevent Vite from obscuring Rust errors.
  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      // Tell Vite to ignore watching `src-tauri`.
      ignored: ["**/src-tauri/**"],
    },
  },

  // Engine unit tests run headless in a node environment (pure, deterministic logic).
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});
