import { describe, expect, it } from "vitest";
import type { ProjectRow } from "@/lib/ipc";
import { lastActivity, recentProjects } from "./sidebar.util";

function row(overrides: Partial<ProjectRow>): ProjectRow {
  return {
    id: "/code/app",
    name: "app",
    grade: "C",
    score: 70,
    file_count: 1,
    issue_count: 0,
    logo: null,
    modified: null,
    harness: null,
    session_count: 0,
    last_session_at: null,
    never_used_count: 0,
    error_count: 0,
    exists: true,
    ...overrides,
  } as ProjectRow;
}

describe("lastActivity", () => {
  it("reads an ISO session timestamp", () => {
    expect(lastActivity(row({ last_session_at: "2026-09-24T10:00:00.000Z" }))).toBe(
      Date.parse("2026-09-24T10:00:00.000Z"),
    );
  });

  it("reads a file mtime in epoch seconds", () => {
    expect(lastActivity(row({ modified: "1790000000" }))).toBe(1790000000 * 1000);
  });

  it("takes whichever of the two is later", () => {
    const later = row({ modified: "1790000000", last_session_at: "2020-01-01T00:00:00Z" });
    expect(lastActivity(later)).toBe(1790000000 * 1000);
  });

  it("is 0 when neither is known or parseable", () => {
    expect(lastActivity(row({}))).toBe(0);
    expect(lastActivity(row({ modified: "soon", last_session_at: "never" }))).toBe(0);
  });
});

describe("recentProjects", () => {
  it("orders by last activity, not by grade", () => {
    // `list_projects` hands rows back best grade first; the sidebar must not
    // inherit that order, or "recent" is just "healthiest" and never moves.
    const rows = [
      row({ id: "/a", name: "aged-a", grade: "A", modified: "1000" }),
      row({ id: "/f", name: "fresh-f", grade: "F", last_session_at: "2026-09-24T10:00:00Z" }),
    ];
    expect(recentProjects(rows, 6).map((p) => p.name)).toEqual(["fresh-f", "aged-a"]);
  });

  it("drops projects whose folder is gone", () => {
    const rows = [row({ id: "/gone", exists: false, modified: "9999999999" }), row({ id: "/here" })];
    expect(recentProjects(rows, 6).map((p) => p.id)).toEqual(["/here"]);
  });

  it("caps the list at the limit", () => {
    const rows = Array.from({ length: 9 }, (_, i) => row({ id: `/p${i}`, modified: String(i) }));
    expect(recentProjects(rows, 6)).toHaveLength(6);
    expect(recentProjects(rows, 6)[0].id).toBe("/p8");
  });

  it("keeps the fields the sidebar draws", () => {
    const [p] = recentProjects([row({ logo: "data:image/png;base64,x", grade: "B" })], 6);
    expect(p).toEqual({ id: "/code/app", name: "app", grade: "B", logo: "data:image/png;base64,x" });
  });
});
