import { describe, it, expect } from "vitest";
import type { ArtifactView, ProjectSetup } from "@/lib/ipc";
import {
  harnessSummary,
  lastScanAt,
  matchProject,
  projectNameFor,
  projectNameMap,
  relativeSession,
  sessionLabel,
  sortProjects,
  topRuleGrade,
} from "./setup.util";

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
