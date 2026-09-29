import { describe, expect, it } from "vitest";
import type { ArtifactView, EffectiveRule, FileRow, ProjectSetup, ProjectUsage, SetupView } from "@/lib/ipc";
import { lensRows } from "./lens.util";
import { setupRows, type SetupRow } from "./setupRows.util";

const row = (over: Partial<SetupRow>): SetupRow => ({
  id: 1, harness: "claude_code", layer: "global", kind: "skill", name: "x", path: "/x", plugin_name: null,
  description: null, bytes: 0, grade: null, score: null, file_id: null, usage: null, issue_count: null,
  worst_severity: null, origin: "inventory", project_label: null, project_path: null, load_order: null, ...over,
});
const WEB = "/code/web";
const H = "claude_code";

const rows = [
  row({ id: 1, kind: "rule", name: "CLAUDE.md", path: "/h/.claude/CLAUDE.md" }),
  row({ id: 2, kind: "rule", layer: "project", name: "CLAUDE.md", path: `${WEB}/CLAUDE.md`, project_path: WEB }),
  row({ id: 3, kind: "rule", layer: "project", name: "CLAUDE.md", path: "/code/api/CLAUDE.md", project_path: "/code/api" }),
  row({ id: 4, kind: "skill", name: "adapt", usage: { total: 99, sessions: 9, last_used: null, error_rate: 0, avg_turn_tokens: 1, count_30d: 0, count_prev_30d: 0 } }),
  row({ id: 5, kind: "agent", layer: "project", name: "reviewer", path: `${WEB}/.claude/agents/r.md`, project_path: WEB }),
  row({ id: -7, kind: "rule", layer: "project", origin: "graded", name: "AGENTS.md", path: `${WEB}/AGENTS.md`, project_path: WEB, file_id: `${WEB}/AGENTS.md` }),
  row({ id: 6, kind: "skill", layer: "plugin", name: "design", plugin_name: "superpowers" }),
];
const effective: EffectiveRule[] = [
  { layer: "global", path: "/h/.claude/CLAUDE.md", name: "CLAUDE.md", grade: "B", file_id: null },
  { layer: "project", path: `${WEB}/CLAUDE.md`, name: "CLAUDE.md", grade: "C", file_id: null },
];
const usage = {
  sessions_per_day: [],
  ranked: [{ kind: "skill", target: "adapt", artifact_id: 4, uses: 3, sessions: 2, error_rate: 0.5, avg_turn_tokens: 800, last_used: "2026-09-26T10:00:00Z" }],
} as unknown as ProjectUsage;

describe("lensRows", () => {
  it("keeps global, plugin and this project's items, and drops other projects'", () => {
    const ids = lensRows(rows, WEB, effective, usage, H).map((r) => r.id);
    expect(ids).not.toContain(3);
    expect(ids).toEqual(expect.arrayContaining([1, 2, 4, 5, -7, 6]));
  });

  it("numbers instructions in load order and lists them first", () => {
    const out = lensRows(rows, WEB, effective, usage, H);
    expect(out.slice(0, 3).map((r) => [r.id, r.load_order])).toEqual([[1, 1], [2, 2], [-7, null]]);
  });

  it("groups the other kinds after instructions, in kind order then name", () => {
    const rest = lensRows(rows, WEB, effective, usage, H).slice(3).map((r) => r.id);
    expect(rest).toEqual([4, 6, 5]); // skills (adapt, design) before agents
  });

  it("swaps in this project's usage, and none where the item was not used here", () => {
    const out = lensRows(rows, WEB, effective, usage, H);
    expect(out.find((r) => r.id === 4)?.usage).toMatchObject({ total: 3, sessions: 2, error_rate: 0.5, avg_turn_tokens: 800, last_used: "2026-09-26T10:00:00Z" });
    expect(out.find((r) => r.id === 5)?.usage).toBeNull();
  });

  it("still lists everything, unnumbered, for a project no harness has worked in", () => {
    const out = lensRows(rows, WEB, null, null, H);
    expect(out.every((r) => r.load_order === null)).toBe(true);
    expect(out.find((r) => r.id === 4)?.usage).toBeNull();
  });

  it("matches a project path with or without a trailing slash", () => {
    expect(lensRows(rows, `${WEB}/`, effective, usage, H).map((r) => r.id)).toContain(5);
  });

  it("excludes a sibling path that merely shares the prefix", () => {
    const sibling = row({ id: 40, kind: "agent", layer: "project", name: "x", path: "/code/web2/a.md", project_path: "/code/web2" });
    expect(lensRows([...rows, sibling], WEB, effective, usage, H).map((r) => r.id)).not.toContain(40);
  });

  it("matches a row whose project_path has a trailing slash", () => {
    const slash = row({ id: 41, kind: "agent", layer: "project", name: "y", path: `${WEB}/a.md`, project_path: `${WEB}/` });
    expect(lensRows([...rows, slash], WEB, effective, usage, H).map((r) => r.id)).toContain(41);
  });

  it("drops another harness's rows, so its global rules do not appear unnumbered", () => {
    const other = row({ id: 42, harness: "codex", kind: "rule", name: "AGENTS.md", path: "/h/.codex/AGENTS.md" });
    expect(lensRows([...rows, other], WEB, effective, usage, H).map((r) => r.id)).not.toContain(42);
  });

  it("keeps this project's graded-only file, which no harness claims (setupRows gives it harness \"\")", () => {
    const orphan = row({ id: -8, harness: "", kind: "rule", layer: "project", origin: "graded", name: "GEMINI.md", path: `${WEB}/GEMINI.md`, project_path: WEB });
    expect(lensRows([...rows, orphan], WEB, effective, usage, H).map((r) => r.id)).toContain(-8);
  });

  it("gives kinds without per-project usage no usage at all", () => {
    const hook = row({ id: 43, kind: "hook", name: "h", usage: { total: 5, sessions: 1, last_used: null, error_rate: 0, avg_turn_tokens: 0, count_30d: 0, count_prev_30d: 0 } });
    expect(lensRows([...rows, hook], WEB, effective, usage, H).find((r) => r.id === 43)?.usage).toBeNull();
  });

  it("orders equal names case-insensitively", () => {
    const a = row({ id: 44, name: "Zeta" }), b = row({ id: 45, name: "alpha" });
    expect(lensRows([a, b], WEB, null, null, H).map((r) => r.id)).toEqual([45, 44]);
  });

  it("labels a plugin's items as coming from an installed plugin", () => {
    expect(lensRows(rows, WEB, effective, usage, H).find((r) => r.id === 6)?.plugin_name).toBe("superpowers · installed plugin");
  });

  it("makes no subfolder claim: EffectiveRule carries no subfolder", () => {
    for (const r of lensRows(rows, WEB, effective, usage, H)) {
      expect(`${r.description ?? ""} ${r.plugin_name ?? ""}`).not.toMatch(/loaded when working in/);
    }
  });
});

describe("lensRows over a SetupView (spec §14: only what loads there)", () => {
  const art = (over: Partial<ArtifactView>): ArtifactView => ({
    id: 1, harness: "claude_code", layer: "global", kind: "skill", name: "x", path: "/x", plugin_name: null,
    description: null, bytes: 0, grade: null, score: null, file_id: null, usage: null, issue_count: null,
    worst_severity: null, ...over,
  });
  const project = (path: string, artifacts: ArtifactView[]): ProjectSetup => ({
    harness: "claude_code", path, name: path.split("/").pop() ?? path, exists: true, session_count: 1,
    last_session_at: null, artifacts,
  });
  const view: SetupView = {
    harnesses: [],
    global: [
      art({ id: 10, kind: "rule", name: "CLAUDE.md", path: "/h/.claude/CLAUDE.md" }),
      art({ id: 11, kind: "skill", name: "adapt" }),
      art({ id: 12, kind: "skill", layer: "plugin", name: "design", plugin_name: "superpowers" }),
    ],
    projects: [
      project(WEB, [art({ id: 20, kind: "rule", layer: "project", name: "CLAUDE.md", path: `${WEB}/CLAUDE.md` }),
        art({ id: 21, kind: "agent", layer: "project", name: "reviewer", path: `${WEB}/.claude/agents/r.md` })]),
      project("/code/api", [art({ id: 30, kind: "rule", layer: "project", name: "CLAUDE.md", path: "/code/api/CLAUDE.md" }),
        art({ id: 31, kind: "command", layer: "project", name: "deploy", path: "/code/api/.claude/commands/deploy.md" })]),
    ],
  };
  const api: FileRow = { id: "/code/api/AGENTS.md", name: "AGENTS.md", path: "/code/api/AGENTS.md", project: "api",
    project_id: "/code/api", kind: "AGENTS.md", grade: "C", score: 70, issue_count: 1, modified: null, worst_severity: "lo" } as FileRow;

  it("includes global, plugin and this project's items, and excludes every other project's", () => {
    const ids = lensRows(setupRows(view, [api]), WEB, null, null, H).map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([10, 11, 12, 20, 21]));
    expect(ids).not.toContain(30);
    expect(ids).not.toContain(31);
    expect(ids).toHaveLength(5); // the api project's graded-only AGENTS.md is excluded too
  });
});
