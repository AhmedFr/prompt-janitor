import { describe, expect, it } from "vitest";
import type { ArtifactView, FileRow, ProjectSetup, SetupView } from "@/lib/ipc";
import { byKindThenName, loadedInFor, setupRows, syntheticId, type SetupRow } from "@/lib/setupRows";

const artifact = (over: Partial<ArtifactView>): ArtifactView => ({
  id: 1,
  harness: "claude_code",
  layer: "global",
  kind: "skill",
  name: "adapt",
  path: "/h/.claude/skills/adapt/SKILL.md",
  plugin_name: null,
  description: null,
  bytes: 100,
  grade: null,
  score: null,
  file_id: null,
  usage: null,
  issue_count: null,
  worst_severity: null,
  ...over,
});
const file = (over: Partial<FileRow>): FileRow => ({
  id: "/code/app/AGENTS.md",
  name: "AGENTS.md",
  path: "/code/app/AGENTS.md",
  project: "app",
  project_id: "/code/app",
  kind: "AGENTS.md",
  grade: "C",
  score: 70,
  issue_count: 2,
  modified: null,
  worst_severity: "mid",
  ...over,
});
const view = (global: ArtifactView[], projectArtifacts: ArtifactView[] = []): SetupView => ({
  harnesses: [],
  global,
  projects: [
    {
      harness: "claude_code",
      path: "/code/app",
      name: "app",
      exists: true,
      session_count: 3,
      last_session_at: null,
      artifacts: projectArtifacts,
    },
  ],
});

describe("setupRows", () => {
  it("keeps every inventory row, marked as inventory", () => {
    const rows = setupRows(view([artifact({ id: 7 })]), []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 7, origin: "inventory", load_order: null });
  });

  it("adds a graded file no inventory row points at, as an instruction of its project", () => {
    const rows = setupRows(view([]), [file({})]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      origin: "graded",
      kind: "rule",
      layer: "project",
      name: "AGENTS.md",
      file_id: "/code/app/AGENTS.md",
      project_label: "app",
      project_path: "/code/app",
      issue_count: 2,
      worst_severity: "mid",
      grade: "C",
    });
    expect(rows[0].id).toBeLessThan(0);
  });

  it("does not duplicate a graded file the inventory already has", () => {
    const inInventory = artifact({ id: 3, kind: "rule", name: "CLAUDE.md", file_id: "/code/app/CLAUDE.md" });
    const rows = setupRows(view([], [inInventory]), [file({ id: "/code/app/CLAUDE.md", name: "CLAUDE.md" })]);
    expect(rows.map((r) => r.id)).toEqual([3]);
  });

  it("gives a project's inventory rows their project path", () => {
    const rows = setupRows(view([], [artifact({ id: 9, layer: "project", path: "/code/app/.claude/agents/x.md" })]), []);
    expect(rows[0].project_path).toBe("/code/app");
  });
});

describe("syntheticId", () => {
  it("is negative and stable for the same file", () => {
    expect(syntheticId("/a/b")).toBeLessThan(0);
    expect(syntheticId("/a/b")).toBe(syntheticId("/a/b"));
    expect(syntheticId("/a/b")).not.toBe(syntheticId("/a/c"));
  });
});

const row = (over: Partial<SetupRow>): SetupRow => ({
  ...artifact({}),
  origin: "inventory",
  project_label: null,
  project_path: null,
  load_order: null,
  ...over,
});

describe("byKindThenName", () => {
  it("orders by chip order, then by name without regard to case", () => {
    const rows = [
      row({ id: 1, kind: "skill", name: "zeta" }),
      row({ id: 2, kind: "rule", name: "CLAUDE.md" }),
      row({ id: 3, kind: "skill", name: "Alpha" }),
      row({ id: 4, kind: "mcp_server", name: "github" }),
      row({ id: 5, kind: "rule", name: "AGENTS.md" }),
    ];
    expect(byKindThenName(rows).map((r) => r.id)).toEqual([5, 2, 3, 1, 4]);
  });

  it("does not mutate its input", () => {
    const rows = [row({ id: 1, name: "b" }), row({ id: 2, name: "a" })];
    byKindThenName(rows);
    expect(rows.map((r) => r.id)).toEqual([1, 2]);
  });
});

describe("loadedInFor", () => {
  const projects = [
    { path: "/code/web", name: "web", exists: true },
    { path: "/code/api", name: "api", exists: true },
    { path: "/code/gone", name: "gone", exists: false },
  ] as ProjectSetup[];

  it("loads a global or plugin row in every project that still exists", () => {
    expect(loadedInFor(row({ layer: "global" }), projects)).toEqual([
      { path: "/code/web", name: "web" }, { path: "/code/api", name: "api" },
    ]);
    expect(loadedInFor(row({ layer: "plugin" }), projects)).toHaveLength(2);
  });

  it("loads a project row only in its own project", () => {
    expect(loadedInFor(row({ layer: "project", project_path: "/code/api" }), projects)).toEqual([
      { path: "/code/api", name: "api" },
    ]);
  });
});
