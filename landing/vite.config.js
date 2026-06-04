import { defineConfig } from "vite";

// Relative base so the build works under any path — a GitHub Pages project
// subpath (/prompt-janitor/), a custom domain root, or opened from disk.
export default defineConfig({
  base: "./",
});
