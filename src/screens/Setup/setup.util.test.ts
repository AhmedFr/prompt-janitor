import { describe, it, expect } from "vitest";
import type { ArtifactKind, ArtifactView, ProjectSetup, UsageStat } from "@/lib/ipc";
import {
  applyFilter,
  costThreshold,
  filterCounts,
  groupByKind,
  harnessSummary,
  kindHeading,
  projectMatchCount,
  relativeSession,
  sessionLabel,
  sortProjects,
  topRuleGrade,
} from "./setup.util";

const usage = (o: Partial<UsageStat> = {}): UsageStat => ({
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
  usage: null,
  ...o,
});

const project = (o: Partial<ProjectSetup> = {}): ProjectSetup => ({
  harness: "claude_code",
  path: "/p",
  name: "p",
  exists: true,
  session_count: 0,
  last_session_at: null,
  artifacts: [],
  ...o,
});

describe("groupByKind", () => {
  it("groups in canonical kind order and omits empty kinds", () => {
    const items = [
      artifact({ id: 1, kind: "settings", name: "settings.json" }),
      artifact({ id: 2, kind: "skill", name: "debugging" }),
      artifact({ id: 3, kind: "rule", name: "no-console" }),
      artifact({ id: 4, kind: "skill", name: "planning" }),
    ];

    const groups = groupByKind(items);

    expect(groups.map((g) => g.kind)).toEqual<ArtifactKind[]>(["rule", "skill", "settings"]);
    expect(groups[1].items.map((a) => a.name)).toEqual(["debugging", "planning"]);
    expect(groups.some((g) => g.items.length === 0)).toBe(false);
  });

  it("returns nothing for an empty list", () => {
    expect(groupByKind([])).toEqual([]);
  });
});

describe("applyFilter", () => {
  const never = artifact({ id: 1, name: "never", usage: null });
  const errorProne = artifact({
    id: 2,
    name: "errors",
    usage: usage({ error_rate: 0.4, avg_turn_tokens: 400 }),
  });
  const cheap = artifact({
    id: 3,
    name: "cheap",
    usage: usage({ error_rate: 0.1, avg_turn_tokens: 500 }),
  });
  const pricey = artifact({
    id: 4,
    name: "pricey",
    usage: usage({ error_rate: 0, avg_turn_tokens: 4000 }),
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
    const onThreshold = artifact({ id: 5, name: "edge", usage: usage({ error_rate: 0.25 }) });
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
      artifact({ id, usage: avg == null ? null : usage({ avg_turn_tokens: avg }) });
    // Odd count: the middle value.
    expect(costThreshold([at(1, 100), at(2, 300), at(3, 4000)])).toBe(600);
    // Even count: the mean of the middle pair — (300 + 500) / 2 = 400.
    expect(costThreshold([at(1, 100), at(2, 300), at(3, 500), at(4, 4000)])).toBe(800);
    // Unmeasured artifacts do not drag the median down.
    expect(costThreshold([at(1, 100), at(2, 300), at(3, null)])).toBe(400);
  });

  it("has no opinion with fewer than two measured artifacts", () => {
    expect(costThreshold([artifact({ usage: usage({ avg_turn_tokens: 900 }) })])).toBeNull();
    expect(costThreshold([])).toBeNull();
  });
});

describe("projectMatchCount", () => {
  const p = project({
    artifacts: [
      artifact({ id: 1, name: "never", usage: null }),
      artifact({ id: 2, name: "errors", usage: usage({ error_rate: 0.4, avg_turn_tokens: 400 }) }),
      artifact({ id: 3, name: "pricey", usage: usage({ avg_turn_tokens: 4000 }) }),
    ],
  });

  it("counts everything for `all`", () => {
    expect(projectMatchCount(p, "all", 1000)).toBe(3);
  });

  it("counts only the artifacts the filter keeps", () => {
    expect(projectMatchCount(p, "never", 1000)).toBe(1);
    expect(projectMatchCount(p, "errors", 1000)).toBe(1);
    expect(projectMatchCount(p, "cost", 1000)).toBe(1);
  });

  it("is zero for a project with nothing in the slice, so the row can be pruned", () => {
    expect(projectMatchCount(project(), "never", 1000)).toBe(0);
    expect(projectMatchCount(p, "cost", null)).toBe(0);
  });
});

describe("filterCounts", () => {
  it("counts every chip's slice over the artifacts it is handed", () => {
    const all = [
      artifact({ id: 1, usage: null }),
      artifact({ id: 2, usage: null }),
      artifact({ id: 3, usage: usage({ error_rate: 0.4, avg_turn_tokens: 400 }) }),
      artifact({ id: 4, usage: usage({ avg_turn_tokens: 500 }) }),
      artifact({ id: 5, usage: usage({ avg_turn_tokens: 4000 }) }),
    ];
    // Measured costs 400/500/4000 → median 500 → bar 1000.
    expect(filterCounts(all, costThreshold(all))).toEqual({
      all: 5,
      never: 2,
      errors: 1,
      cost: 1,
    });
  });

  it("reports zeroes rather than blanks for an empty inventory", () => {
    expect(filterCounts([], null)).toEqual({ all: 0, never: 0, errors: 0, cost: 0 });
  });
});

describe("topRuleGrade", () => {
  it("takes the first graded rule in the project", () => {
    expect(
      topRuleGrade(
        project({
          artifacts: [
            artifact({ id: 1, kind: "skill", grade: "A" }),
            artifact({ id: 2, kind: "rule", grade: null }),
            artifact({ id: 3, kind: "rule", grade: "C" }),
          ],
        }),
      ),
    ).toBe("C");
  });

  it("is null when the project has no graded rule", () => {
    expect(topRuleGrade(project({ artifacts: [artifact({ kind: "skill", grade: "A" })] }))).toBeNull();
    expect(topRuleGrade(project())).toBeNull();
  });
});

describe("kindHeading", () => {
  it("pluralises the kind label, leaving already-plural labels alone", () => {
    expect(kindHeading("rule")).toBe("Rules");
    expect(kindHeading("mcp_server")).toBe("MCP Servers");
    expect(kindHeading("settings")).toBe("Settings");
  });
});

describe("sortProjects", () => {
  it("puts existing projects first, then newest session, nulls last", () => {
    const projects = [
      project({ name: "gone", exists: false, last_session_at: "2026-08-20T00:00:00.000Z" }),
      project({ name: "quiet", last_session_at: null }),
      project({ name: "old", last_session_at: "2026-08-01T00:00:00.000Z" }),
      project({ name: "fresh", last_session_at: "2026-08-19T00:00:00.000Z" }),
    ];

    expect(sortProjects(projects).map((p) => p.name)).toEqual(["fresh", "old", "quiet", "gone"]);
  });

  it("does not mutate its input", () => {
    const projects = [project({ name: "a" }), project({ name: "b", exists: false })];
    const copy = [...projects];
    sortProjects(projects);
    expect(projects).toEqual(copy);
  });
});

describe("relativeSession", () => {
  const now = new Date("2026-08-20T12:00:00.000Z");

  it("formats ISO timestamps as a coarse relative age", () => {
    expect(relativeSession("2026-08-20T11:40:00.000Z", now)).toBe("just now");
    expect(relativeSession("2026-08-20T06:00:00.000Z", now)).toBe("6h ago");
    expect(relativeSession("2026-08-17T12:00:00.000Z", now)).toBe("3d ago");
    expect(relativeSession("2026-05-20T12:00:00.000Z", now)).toBe("3mo ago");
  });

  it("falls back to `never` for a missing or unparseable timestamp", () => {
    expect(relativeSession(null, now)).toBe("never");
    expect(relativeSession("not-a-date", now)).toBe("never");
  });
});

describe("harnessSummary", () => {
  it("reads as one line and pluralises both counts", () => {
    const harness = {
      id: "claude_code",
      display_name: "Claude Code",
      detected: true,
      last_scan_at: null,
      project_count: 32,
      session_count: 177,
    };
    expect(harnessSummary(harness)).toBe("Claude Code · 32 projects · 177 sessions");
    expect(harnessSummary({ ...harness, project_count: 1, session_count: 1 })).toBe(
      "Claude Code · 1 project · 1 session",
    );
  });
});

describe("sessionLabel", () => {
  it("pluralises the session count", () => {
    expect(sessionLabel(0)).toBe("0 sessions");
    expect(sessionLabel(1)).toBe("1 session");
    expect(sessionLabel(12)).toBe("12 sessions");
  });
});
