import { describe, it, expect } from "vitest";
import type { ArtifactView, ProjectSetup, UsageStat } from "@/lib/ipc";
import {
  allArtifacts,
  applyFilter,
  costThreshold,
  filterCounts,
  harnessSummary,
  lastScanAt,
  matchProject,
  pluginBundleCounts,
  projectNameFor,
  projectNameMap,
  relativeSession,
  rowsByKind,
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

  it("groups a count that runs into the thousands", () => {
    // A real machine's session count does; "1204 sessions" is read digit by
    // digit, so the shared formatter groups.
    expect(sessionLabel(1204)).toBe("1,204 sessions");
  });
});

describe("matchProject", () => {
  const projectNames = new Map([
    ["/code/acme-api", "acme-api"],
    ["/code/acme-api-admin", "acme-api-admin"],
  ]);

  it("matches a file under a project's root", () => {
    expect(matchProject("/code/acme-api/.claude/commands/deploy.md", projectNames)).toEqual({
      path: "/code/acme-api",
      name: "acme-api",
    });
  });

  it("does not treat a sibling with a shared prefix as a match", () => {
    // "/code/acme-api-admin/..." starts with "/code/acme-api" as a raw string
    // prefix but is not *inside* that project — the boundary has to be a path
    // separator, not just any character.
    expect(matchProject("/code/acme-api-admin/CLAUDE.md", projectNames)).toEqual({
      path: "/code/acme-api-admin",
      name: "acme-api-admin",
    });
  });

  it("matches the project root path itself", () => {
    expect(matchProject("/code/acme-api", projectNames)).toEqual({
      path: "/code/acme-api",
      name: "acme-api",
    });
  });

  it("returns null for a path outside every known project", () => {
    expect(matchProject("/Users/ada/.claude/rules/web.md", projectNames)).toBeNull();
  });

  it("prefers the longest matching root for nested projects", () => {
    const nested = new Map([
      ["/code", "monorepo"],
      ["/code/packages/api", "api"],
    ]);
    expect(matchProject("/code/packages/api/src/index.ts", nested)?.name).toBe("api");
  });
});

describe("projectNameFor", () => {
  const projectNames = new Map([["/code/acme-api", "acme-api"]]);

  it("resolves to the matching project's name", () => {
    expect(projectNameFor("/code/acme-api/CLAUDE.md", projectNames)).toBe("acme-api");
  });

  it("is null outside every known project", () => {
    expect(projectNameFor("/Users/ada/.claude/rules/web.md", projectNames)).toBeNull();
  });
});

describe("allArtifacts", () => {
  it("flattens the global layer and every project into one list", () => {
    const view = {
      harnesses: [],
      global: [artifact({ id: 1 }), artifact({ id: 2 })],
      projects: [
        project({ artifacts: [artifact({ id: 3, layer: "project" })] }),
        project({ artifacts: [] }),
      ],
    };
    expect(allArtifacts(view).map((a) => a.id)).toEqual([1, 2, 3]);
  });
});

describe("rowsByKind", () => {
  it("buckets by kind, keeping input order inside a bucket", () => {
    const rows = rowsByKind([
      artifact({ id: 1, kind: "skill", name: "a" }),
      artifact({ id: 2, kind: "rule", name: "b" }),
      artifact({ id: 3, kind: "skill", name: "c" }),
    ]);
    expect(rows.get("skill")?.map((a) => a.name)).toEqual(["a", "c"]);
    expect(rows.get("rule")?.map((a) => a.name)).toEqual(["b"]);
  });

  it("gives every kind an entry, so an empty tab still counts zero", () => {
    const rows = rowsByKind([]);
    expect(rows.get("agent")).toEqual([]);
    expect(rows.get("plugin")).toEqual([]);
  });
});

describe("projectNameMap", () => {
  it("maps each project's root path to its display name", () => {
    const map = projectNameMap([
      project({ path: "/code/web", name: "web" }),
      project({ path: "/code/api", name: "api" }),
    ]);
    expect([...map]).toEqual([
      ["/code/web", "web"],
      ["/code/api", "api"],
    ]);
  });
});

describe("pluginBundleCounts", () => {
  it("counts what each plugin bundled, never the plugin's own manifest row", () => {
    const counts = pluginBundleCounts([
      artifact({ id: 1, kind: "plugin", layer: "plugin", name: "sp", plugin_name: "sp" }),
      artifact({ id: 2, kind: "skill", layer: "plugin", name: "brainstorm", plugin_name: "sp" }),
      artifact({ id: 3, kind: "agent", layer: "plugin", name: "reviewer", plugin_name: "sp" }),
      artifact({ id: 4, kind: "skill", layer: "global", name: "adapt" }),
    ]);
    expect(counts.get("sp")).toBe(2);
  });

  it("ignores an artifact that names a plugin without being installed by one", () => {
    const counts = pluginBundleCounts([
      artifact({ id: 1, kind: "skill", layer: "project", name: "copy", plugin_name: "sp" }),
    ]);
    expect(counts.get("sp")).toBeUndefined();
  });
});

describe("lastScanAt", () => {
  const harness = (id: string, last_scan_at: string | null) => ({
    id,
    display_name: id,
    detected: true,
    last_scan_at,
    project_count: 0,
    session_count: 0,
  });

  it("takes the most recent scan across harnesses", () => {
    expect(
      lastScanAt([
        harness("a", "2026-08-19T08:00:00.000Z"),
        harness("b", "2026-08-20T09:00:00.000Z"),
        harness("c", null),
      ]),
    ).toBe("2026-08-20T09:00:00.000Z");
  });

  it("is null when nothing has been scanned", () => {
    expect(lastScanAt([harness("a", null)])).toBeNull();
    expect(lastScanAt([])).toBeNull();
  });
});
