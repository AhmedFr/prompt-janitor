import { describe, expect, it } from "vitest";
import type { SetupRow } from "./setupRows.util";
import { applySetupFilter, setupFilterCounts } from "./setupFilter.util";

const row = (over: Partial<SetupRow>): SetupRow => ({
  id: 1, harness: "claude_code", layer: "global", kind: "skill", name: "x", path: "/x", plugin_name: null,
  description: null, bytes: 400, grade: null, score: null, file_id: null, usage: null, issue_count: null,
  worst_severity: null, origin: "inventory", project_label: null, project_path: null, load_order: null, ...over,
});
const used = (error_rate = 0, avg_turn_tokens = 100) =>
  ({ total: 5, sessions: 2, last_used: null, error_rate, avg_turn_tokens, count_30d: 5, count_prev_30d: 0 }) as SetupRow["usage"];

describe("never used on a mixed slice (spec §4.2)", () => {
  const rows = [
    row({ id: 1, kind: "skill" }),
    row({ id: 2, kind: "agent" }),
    row({ id: 3, kind: "command", usage: used() }),
    row({ id: 4, kind: "rule" }),
    row({ id: 5, kind: "hook" }),
    row({ id: 6, kind: "plugin" }),
    row({ id: 7, kind: "settings" }),
    row({ id: 8, kind: "mcp_server" }),
  ];

  it("counts only skills, agents, commands and MCP servers with no recorded use", () => {
    expect(setupFilterCounts(rows, null).never).toBe(3);
  });

  it("filters to those same rows", () => {
    expect(applySetupFilter(rows, "never", null).map((r) => r.id)).toEqual([1, 2, 8]);
  });

  it("never counts instructions, hooks, plugins or config, whatever their usage", () => {
    const nonUsage = rows.filter((r) => ["rule", "hook", "plugin", "settings"].includes(r.kind));
    expect(setupFilterCounts(nonUsage, null).never).toBe(0);
  });
});

describe("erroring and costly", () => {
  it("keep applyFilter's definitions", () => {
    const rows = [row({ id: 1, usage: used(0.5, 100) }), row({ id: 2, usage: used(0, 9000) })];
    expect(setupFilterCounts(rows, 5000)).toEqual({ never: 0, errors: 1, cost: 1 });
    expect(applySetupFilter(rows, "errors", 5000).map((r) => r.id)).toEqual([1]);
    expect(applySetupFilter(rows, "cost", 5000).map((r) => r.id)).toEqual([2]);
    expect(applySetupFilter(rows, "all", 5000)).toBe(rows);
  });
});
