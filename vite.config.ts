import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { configDefaults } from "vitest/config";

// Tauri expects a fixed dev port and leaves the console for the Rust side.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  // Only Tauri's own TAURI_ENV_* vars, never the bare TAURI_ prefix: the
  // release build runs with TAURI_SIGNING_PRIVATE_KEY in its environment and
  // a bare prefix would put it one `import.meta.env` reference away from the
  // shipped bundle.
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    target: "safari15",
    minify: process.env.TAURI_DEBUG ? false : "esbuild",
    sourcemap: !!process.env.TAURI_DEBUG,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // landing/ and fulfillment/ are self-contained pnpm packages with their
    // own vitest configs and toolchains; don't let this project's default
    // test glob pick up their test files. `.claude/**` holds nested git
    // worktrees (duplicate repo checkouts) that must not be scanned either.
    // benchmark/fixtures ships deliberately-broken tests the benchmark agent
    // must repair; they are exercised by the harness, never by this suite.
    exclude: [...configDefaults.exclude, "landing/**", "fulfillment/**", ".claude/**", "benchmark/**"],
  },
});
