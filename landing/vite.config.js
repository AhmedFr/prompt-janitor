import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

// Relative base so the build works under any path — a GitHub Pages project
// subpath (/prompt-janitor/), a custom domain root, or opened from disk.
export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: r("index.html"),
        thanks: r("thanks.html"),
      },
    },
  },
});
