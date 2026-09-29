/**
 * R27: shared code never reaches up into a screen. Nothing under
 * `src/components/` or `src/lib/` imports from `src/screens/`; code both need
 * lives in `src/lib/` (or the component moves under the screen that owns it).
 *
 * Reads the sources through Vite's `?raw` glob (the project has no
 * `@types/node`), so a new file that breaks the rule fails here too.
 */
import { describe, it, expect } from "vitest";

const sources = import.meta.glob(["../components/**/*.{ts,tsx}", "../lib/**/*.{ts,tsx}"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** `from "@/screens/…"`, or a relative path that climbs into `screens/`. */
const SCREEN_IMPORT = /from\s+["'](?:@\/screens\/|(?:\.\.\/)+screens\/)[^"']*["']/;

describe("layering (R27)", () => {
  it("reads the shared sources", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });

  it("no component or lib module imports a screen", () => {
    const offenders = Object.entries(sources)
      .filter(([, source]) => SCREEN_IMPORT.test(source))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
