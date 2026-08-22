import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ArtifactView, ProjectSetup, SetupView } from "@/lib/ipc";
import { useSetupTables } from "./useSetupTables";

const artifact = (o: Partial<ArtifactView> = {}): ArtifactView => ({
  id: 1,
  harness: "claude_code",
  layer: "global",
  kind: "rule",
  name: "a",
  path: "/a.md",
  plugin_name: null,
  description: null,
  bytes: 10,
  grade: null,
  score: null,
  file_id: null,
  usage: null,
  ...o,
});

const project = (o: Partial<ProjectSetup> = {}): ProjectSetup => ({
  harness: "claude_code",
  path: "/repo/web",
  name: "web",
  exists: true,
  session_count: 3,
  last_session_at: null,
  artifacts: [],
  ...o,
});

const view: SetupView = {
  harnesses: [],
  global: [
    artifact({ id: 1, kind: "rule", name: "global-style" }),
    artifact({ id: 2, kind: "skill", name: "adapt" }),
    artifact({ id: 3, kind: "plugin", layer: "plugin", name: "sp", plugin_name: "sp" }),
    artifact({ id: 4, kind: "skill", layer: "plugin", name: "brainstorm", plugin_name: "sp" }),
    artifact({ id: 6, kind: "settings", name: "settings.json" }),
  ],
  projects: [
    project({
      artifacts: [
        artifact({
          id: 5,
          layer: "project",
          kind: "skill",
          name: "deploy",
          path: "/repo/web/.claude/skills/deploy/SKILL.md",
        }),
      ],
    }),
  ],
};

const onOpen = () => {};

describe("useSetupTables", () => {
  it("counts every tab across the global layer and every project", () => {
    const { result } = renderHook(() => useSetupTables(view, onOpen));

    expect(result.current.tabs.map((tab) => [tab.label, tab.count])).toEqual([
      ["Rules", 1],
      ["Skills", 3],
      ["Agents", 0],
      ["Commands", 0],
      ["Hooks", 0],
      ["MCP", 0],
      ["Plugins", 1],
      ["Settings", 1],
    ]);
  });

  it("hands the column context the project names and the bundled counts", () => {
    const { result } = renderHook(() => useSetupTables(view, onOpen));

    expect(result.current.ctx.projectNames.get("/repo/web")).toBe("web");
    expect(result.current.ctx.pluginBundleCounts?.get("sp")).toBe(1);
    expect(result.current.ctx.onOpen).toBe(onOpen);
  });

  it("keeps every derived value identity-stable while the data is unchanged", () => {
    const { result, rerender } = renderHook(() => useSetupTables(view, onOpen));
    const first = result.current;

    rerender();

    expect(result.current.ctx).toBe(first.ctx);
    expect(result.current.tabs).toBe(first.tabs);
    expect(result.current.rowsFor("skill")).toBe(first.rowsFor("skill"));
  });

  it("rebuilds — never mutates — when a rescan swaps the data in", () => {
    const { result, rerender } = renderHook(({ data }) => useSetupTables(data, onOpen), {
      initialProps: { data: view as SetupView | null },
    });
    const first = result.current;

    rerender({ data: { ...view, global: [...view.global, artifact({ id: 7, kind: "agent" })] } });

    expect(result.current.tabs).not.toBe(first.tabs);
    expect(first.tabs.find((tab) => tab.label === "Agents")?.count).toBe(0);
    expect(result.current.tabs.find((tab) => tab.label === "Agents")?.count).toBe(1);
  });

  it("reads as an empty inventory before any data has arrived", () => {
    const { result } = renderHook(() => useSetupTables(null, onOpen));

    expect(result.current.tabs.every((tab) => tab.count === 0)).toBe(true);
    expect(result.current.rowsFor("skill")).toEqual([]);
    expect(result.current.costBar).toBeNull();
  });
});
