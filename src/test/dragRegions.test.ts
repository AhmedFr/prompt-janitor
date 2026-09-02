/**
 * Every screen's toolbar is the window's drag handle.
 *
 * The app runs with `titleBarStyle: "Overlay"` and `hiddenTitle`, so the OS
 * draws no bar to grab: the only way to move the window is the empty strip in
 * a screen's own 52px toolbar plus the sidebar's titlebar. Tauri starts a drag
 * only when the mousedown target *itself* carries `data-tauri-drag-region`, so
 * the attribute has to sit on the outer `.screen__toolbar` container — on an
 * inner `<span>` it would only drag from that span, and a screen that grew a
 * crowded toolbar would quietly lose its grab area.
 *
 * jsdom cannot exercise a native drag, and rendering all eleven screens here
 * would mean re-mocking eleven IPC surfaces, so this reads the sources (via
 * Vite's `?raw` glob — the project has no `@types/node`): a structural guard
 * that also fails for a *new* screen that forgets the attribute, which
 * per-screen render assertions would not.
 */
import { describe, it, expect } from "vitest";

/** The popover is a fixed, tray-anchored card — it has no toolbar to drag. */
const NOT_A_WINDOW_SCREEN = new Set(["Panel"]);

const screenSources = import.meta.glob("../screens/*/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const sharedSources = import.meta.glob(
  ["../components/Sidebar/Sidebar.tsx", "../components/ScreenPlaceholder/ScreenPlaceholder.tsx"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

/**
 * `screens/Rules/Rules.tsx` but not its tests, stories or sub-components:
 * the screen file is the one whose basename matches its folder.
 */
const screens = Object.entries(screenSources)
  .map(([path, source]) => {
    const [, dir, file] = /screens\/([^/]+)\/([^/]+)\.tsx$/.exec(path) ?? [];
    return { dir, file, source };
  })
  .filter(({ dir, file }) => dir && dir === file && !NOT_A_WINDOW_SCREEN.has(dir));

/** The opening tag that carries `className="screen__toolbar"`, if any. */
function toolbarTag(source: string): string | undefined {
  return /<[a-zA-Z][^>]*className="screen__toolbar"[^>]*>/.exec(source)?.[0];
}

function shared(name: string): string {
  const entry = Object.entries(sharedSources).find(([path]) => path.endsWith(`/${name}.tsx`));
  if (!entry) throw new Error(`${name}.tsx not found`);
  return entry[1];
}

describe("window drag regions", () => {
  it("finds every screen", () => {
    // Guards the glob itself: an empty list would make the suite below vacuous.
    expect(screens.map((s) => s.dir).sort()).toEqual([
      "Analytics",
      "Detail",
      "Overview",
      "Project",
      "Projects",
      "Prompts",
      "Rules",
      "RulesNew",
      "Scans",
      "Settings",
      "Setup",
    ]);
  });

  for (const { dir, source } of screens) {
    it(`${dir} renders a toolbar that is a drag region`, () => {
      const tag = toolbarTag(source);
      expect(tag).toBeDefined();
      expect(tag).toContain("data-tauri-drag-region");
    });
  }

  it("the shared placeholder screen's toolbar is a drag region", () => {
    expect(toolbarTag(shared("ScreenPlaceholder"))).toContain("data-tauri-drag-region");
  });

  it("the sidebar keeps its titlebar strip", () => {
    // The strip that clears the macOS traffic lights: the one drag handle
    // present on every screen regardless of what its toolbar holds.
    const tag = /<div[^>]*className="sidebar__titlebar"[^>]*\/?>/.exec(shared("Sidebar"))?.[0];
    expect(tag).toContain("data-tauri-drag-region");
  });
});
