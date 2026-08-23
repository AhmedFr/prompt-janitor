import { describe, it, expect } from "vitest";
import type { EffectiveRule, FileRow, HarnessInfo, RankedTarget } from "@/lib/ipc";
import { filesFor, orderEffectiveRules, projectLastScan, usageRows } from "./project.util";

const file = (o: Partial<FileRow> = {}): FileRow => ({
  id: "/code/app/CLAUDE.md",
  name: "CLAUDE.md",
  path: "/code/app/CLAUDE.md",
  project: "app",
  project_id: "/code/app",
  kind: "CLAUDE.md",
  grade: "B",
  score: 80,
  issue_count: 1,
  modified: "1700000000",
  ...o,
});

const rule = (o: Partial<EffectiveRule> = {}): EffectiveRule => ({
  layer: "project",
  path: "/code/app/CLAUDE.md",
  name: "CLAUDE.md",
  grade: null,
  file_id: null,
  ...o,
});

const target = (o: Partial<RankedTarget> = {}): RankedTarget => ({
  kind: "skill",
  target: "pdf-extract",
  artifact_id: null,
  uses: 12,
  sessions: 3,
  error_rate: null,
  avg_turn_tokens: null,
  ...o,
});

const harness = (o: Partial<HarnessInfo> = {}): HarnessInfo => ({
  id: "claude_code",
  display_name: "Claude Code",
  detected: true,
  last_scan_at: "2026-08-20T09:00:00.000Z",
  project_count: 2,
  session_count: 40,
  ...o,
});

describe("filesFor", () => {
  it("keeps only the files whose project id is this project's root path", () => {
    const rows = [file(), file({ id: "b", project_id: "/code/other" })];
    expect(filesFor(rows, "/code/app").map((f) => f.id)).toEqual(["/code/app/CLAUDE.md"]);
  });

  it("matches the whole id, never a prefix of it", () => {
    // `/code/app-legacy` starts with `/code/app`; it is a different project.
    const rows = [file({ id: "a", project_id: "/code/app-legacy" })];
    expect(filesFor(rows, "/code/app")).toEqual([]);
  });

  it("returns nothing for a project with no scanned files", () => {
    expect(filesFor([], "/code/app")).toEqual([]);
  });
});

describe("orderEffectiveRules", () => {
  it("puts the global layer before the project's own, in load order", () => {
    const ordered = orderEffectiveRules([
      rule({ name: "CLAUDE.md", layer: "project" }),
      rule({ name: "global.md", layer: "global" }),
    ]);
    expect(ordered.map((r) => r.name)).toEqual(["global.md", "CLAUDE.md"]);
  });

  it("slots plugin rules between global and project", () => {
    const ordered = orderEffectiveRules([
      rule({ name: "p", layer: "project" }),
      rule({ name: "g", layer: "global" }),
      rule({ name: "x", layer: "plugin" }),
    ]);
    expect(ordered.map((r) => r.name)).toEqual(["g", "x", "p"]);
  });

  it("keeps the backend's order within a layer", () => {
    const ordered = orderEffectiveRules([
      rule({ name: "second", layer: "global" }),
      rule({ name: "first", layer: "global" }),
    ]);
    expect(ordered.map((r) => r.name)).toEqual(["second", "first"]);
  });

  it("leaves the input array alone", () => {
    const input = [rule({ name: "p", layer: "project" }), rule({ name: "g", layer: "global" })];
    orderEffectiveRules(input);
    expect(input.map((r) => r.name)).toEqual(["p", "g"]);
  });
});

describe("usageRows", () => {
  it("keeps only the targets of the asked-for kind", () => {
    const rows = usageRows([target(), target({ kind: "agent", target: "reviewer" })], "skill");
    expect(rows.map((r) => r.label)).toEqual(["pdf-extract"]);
  });

  it("ranks by uses and names the sessions behind them", () => {
    const rows = usageRows([target({ uses: 12, sessions: 3 })], "skill");
    expect(rows[0]).toMatchObject({ value: 12, secondary: "3 sessions" });
  });

  it("agrees the session noun in number", () => {
    const rows = usageRows([target({ sessions: 1 })], "skill");
    expect(rows[0].secondary).toBe("1 session");
  });

  it("keys a row by kind and target, so two kinds may share a name", () => {
    const rows = usageRows(
      [target({ kind: "agent", target: "review" }), target({ kind: "skill", target: "review" })],
      "agent",
    );
    expect(rows[0].id).toBe("agent:review");
  });

  it("carries the full target as the row's tooltip", () => {
    const rows = usageRows([target({ target: "mcp__github__create_issue" })], "skill");
    expect(rows[0].title).toBe("mcp__github__create_issue");
  });
});

describe("projectLastScan", () => {
  it("reports the scan of the harness that works in this project", () => {
    const harnesses = [
      harness({ id: "claude_code", last_scan_at: "2026-08-20T09:00:00.000Z" }),
      harness({ id: "codex", last_scan_at: "2026-08-21T09:00:00.000Z" }),
    ];
    expect(projectLastScan(harnesses, "claude_code")).toBe("2026-08-20T09:00:00.000Z");
  });

  it("falls back to the most recent scan of any harness when the project names none", () => {
    const harnesses = [
      harness({ id: "claude_code", last_scan_at: "2026-08-20T09:00:00.000Z" }),
      harness({ id: "codex", last_scan_at: "2026-08-21T09:00:00.000Z" }),
    ];
    expect(projectLastScan(harnesses, null)).toBe("2026-08-21T09:00:00.000Z");
  });

  it("falls back the same way for a harness the setup view does not list", () => {
    expect(projectLastScan([harness({ id: "codex" })], "claude_code")).toBe(
      "2026-08-20T09:00:00.000Z",
    );
  });

  it("reports nothing when nothing has ever been scanned", () => {
    expect(projectLastScan([harness({ last_scan_at: null })], "claude_code")).toBeNull();
  });
});
