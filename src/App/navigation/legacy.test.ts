import { describe, expect, it } from "vitest";
import { resolveExternal } from "./legacy";

describe("resolveExternal", () => {
  it.each([
    ["overview", null, { route: "setup", target: {} }],
    ["prompts", null, { route: "setup", target: { kind: "rule" } }],
    ["scans", null, { route: "setup", target: {} }],
    ["analytics", null, { route: "setup", target: {} }],
    ["detail", "/code/web/CLAUDE.md", { route: "setup", target: { open: { fileId: "/code/web/CLAUDE.md" }, tab: "findings" } }],
    ["project", "/code/web", { route: "setup", target: { lens: "/code/web" } }],
    ["rules", "custom", { route: "settings", tab: "checks", checksTab: "custom" }],
    ["rules-new", "ai", { route: "settings", tab: "checks", checksTab: "ai" }],
    ["rules", null, { route: "settings", tab: "checks" }],
    ["rules", "bogus", { route: "settings", tab: "checks" }],
    ["rules-new", null, { route: "settings", tab: "checks" }],
    ["settings", "app", { route: "settings", tab: "about" }],
    ["settings", null, { route: "settings", tab: "folders" }],
    ["projects", null, { route: "projects" }],
    ["setup", "mcp_server", { route: "setup", target: { kind: "mcp_server" } }],
    ["setup", "kind=skill&filter=never", { route: "setup", target: { kind: "skill", filter: "never" } }],
  ])("lands %s (%s) somewhere useful", (route, target, expected) => {
    expect(resolveExternal(route, target)).toEqual(expected);
  });

  it("never blanks the window on a route it does not know", () => {
    expect(resolveExternal("nonsense", "x")).toEqual({ route: "setup", target: {} });
  });

  it("treats an untargeted detail as plain Setup", () => {
    expect(resolveExternal("detail", null)).toEqual({ route: "setup", target: {} });
  });

  it("treats an untargeted project as plain Setup rather than a stale lens", () => {
    expect(resolveExternal("project", undefined)).toEqual({ route: "setup", target: {} });
  });
});
