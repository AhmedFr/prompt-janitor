import { describe, expect, it } from "vitest";
import type { ArtifactView, UsageStat } from "@/lib/ipc";
import type { SetupRow } from "@/lib/setupRows";
import { applyFilter, applySetupFilter, costThreshold, setupFilterCounts } from "./setupFilter";

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

const usageStat = (o: Partial<UsageStat> = {}): UsageStat => ({
  total: 5,
  sessions: 2,
  last_used: "2026-08-19T10:00:00.000Z",
  error_rate: 0,
  avg_turn_tokens: null,
  count_30d: 1,
  count_prev_30d: 1,
  ...o,
});

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
  issue_count: null,
  worst_severity: null,
  usage: null,
  ...o,
});

describe("applyFilter", () => {
  const never = artifact({ id: 1, name: "never", usage: null });
  const errorProne = artifact({
    id: 2,
    name: "errors",
    usage: usageStat({ error_rate: 0.4, avg_turn_tokens: 400 }),
  });
  const cheap = artifact({
    id: 3,
    name: "cheap",
    usage: usageStat({ error_rate: 0.1, avg_turn_tokens: 500 }),
  });
  const pricey = artifact({
    id: 4,
    name: "pricey",
    usage: usageStat({ error_rate: 0, avg_turn_tokens: 4000 }),
  });
  const all = [never, errorProne, cheap, pricey];

  it("returns everything for `all`", () => {
    expect(applyFilter(all, "all")).toEqual(all);
  });

  it("keeps only artifacts nothing ever invoked for `never`", () => {
    expect(applyFilter(all, "never").map((a) => a.name)).toEqual(["never"]);
  });

  it("keeps artifacts at or above the error threshold for `errors`", () => {
    // 0.25 is the shared threshold: 0.4 is in, 0.1 and a missing rate are out.
    const onThreshold = artifact({ id: 5, name: "edge", usage: usageStat({ error_rate: 0.25 }) });
    expect(applyFilter([...all, onThreshold], "errors").map((a) => a.name)).toEqual([
      "errors",
      "edge",
    ]);
  });

  it("keeps artifacts at twice the median turn cost for `cost`", () => {
    // Non-null costs are 400, 500, 4000 → median 500 → threshold 1000.
    expect(applyFilter(all, "cost").map((a) => a.name)).toEqual(["pricey"]);
  });

  it("matches nothing for `cost` with fewer than two measured artifacts", () => {
    expect(applyFilter([never, pricey], "cost")).toEqual([]);
    expect(applyFilter([never], "cost")).toEqual([]);
  });

  it("uses a caller-supplied threshold instead of the local median", () => {
    // The screen computes one threshold over every artifact it knows about, so
    // a section holding only expensive things must not re-normalise to itself.
    expect(applyFilter([cheap, pricey], "cost", 600).map((a) => a.name)).toEqual([
      "pricey",
    ]);
    expect(applyFilter([cheap, pricey], "cost", null)).toEqual([]);
  });
});

describe("costThreshold", () => {
  it("doubles the median of the measured artifacts", () => {
    const at = (id: number, avg: number | null) =>
      artifact({ id, usage: avg == null ? null : usageStat({ avg_turn_tokens: avg }) });
    // Odd count: the middle value.
    expect(costThreshold([at(1, 100), at(2, 300), at(3, 4000)])).toBe(600);
    // Even count: the mean of the middle pair — (300 + 500) / 2 = 400.
    expect(costThreshold([at(1, 100), at(2, 300), at(3, 500), at(4, 4000)])).toBe(800);
    // Unmeasured artifacts do not drag the median down.
    expect(costThreshold([at(1, 100), at(2, 300), at(3, null)])).toBe(400);
  });

  it("has no opinion with fewer than two measured artifacts", () => {
    expect(costThreshold([artifact({ usage: usageStat({ avg_turn_tokens: 900 }) })])).toBeNull();
    expect(costThreshold([])).toBeNull();
  });
});
