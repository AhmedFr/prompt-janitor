import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen, within } from "@testing-library/react";
import type { Grade, ProjectRow } from "@/lib/ipc";
import { DataTable } from "@/components/DataTable";
import { DEFAULT_SORT, PROJECT_COLUMNS, buildPills, gradeKey, harnessLabel } from "./projects.columns";

afterEach(cleanup);

const project = (o: Partial<ProjectRow> = {}): ProjectRow => ({
  id: "/code/app",
  name: "app",
  grade: "B",
  score: 80,
  file_count: 3,
  issue_count: 2,
  logo: null,
  modified: null,
  harness: "claude_code",
  session_count: 12,
  last_session_at: "2026-08-20T09:00:00.000Z",
  never_used_count: 1,
  error_count: 0,
  exists: true,
  ...o,
});

let mountCount = 0;

/**
 * Mounts a real `DataTable` with the project column defs — the only faithful
 * way to see what a cell renders. `stateKey` is suffixed with a counter so
 * each render gets its own `sessionStorage` slot; `DataTable` persists sort
 * and search state under `pj.table.<key>`.
 */
function mount(rows: ProjectRow[], sort = DEFAULT_SORT) {
  mountCount += 1;
  return render(
    <DataTable
      columns={PROJECT_COLUMNS}
      rows={rows}
      rowId={(r) => r.id}
      empty={{ title: "Nothing here" }}
      stateKey={`test-projects-${mountCount}`}
      ariaLabel="Projects"
      defaultSort={sort}
    />,
  );
}

/** Every body row's cells as text, in render order. */
function bodyRows(): string[][] {
  return within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent ?? ""));
}

const names = () => bodyRows().map((cells) => cells[0]);

describe("PROJECT_COLUMNS", () => {
  it("lists the project columns in spec order", () => {
    expect(PROJECT_COLUMNS.map((c) => c.id)).toEqual([
      "name",
      "grade",
      "files",
      "issues",
      "sessions",
      "lastSession",
      "neverUsed",
      "errors",
      "status",
    ]);
  });

  it("headers the columns the way the spec names them", () => {
    expect(PROJECT_COLUMNS.map((c) => c.header)).toEqual([
      "Name",
      "Grade",
      "Rule files",
      "Open issues",
      "Sessions",
      "Last session",
      "Never used",
      "Errors",
      "Status",
    ]);
  });

  it("renders the project name beside its glyph", () => {
    mount([project({ name: "web-app", grade: "A" })]);
    expect(screen.getByText("web-app")).toBeInTheDocument();
    // The folder glyph stands in for a project with no detected logo.
    expect(screen.getByRole("img", { name: "web-app project" })).toBeInTheDocument();
  });

  it("renders the grade as a chip", () => {
    mount([project({ grade: "D" })]);
    expect(screen.getByLabelText("Grade D")).toHaveTextContent("D");
  });

  it("renders the rollup counts in their own cells", () => {
    mount([
      project({ file_count: 7, issue_count: 4, session_count: 31, never_used_count: 2, error_count: 5 }),
    ]);
    const cells = bodyRows()[0];
    expect(cells[2]).toBe("7");
    expect(cells[3]).toBe("4");
    expect(cells[4]).toBe("31");
    expect(cells[6]).toBe("2");
    expect(cells[7]).toBe("5");
  });

  it("renders the last session as a relative age, and 'never' when there is none", () => {
    mount([
      project({ id: "/a", name: "a", last_session_at: null }),
      project({ id: "/b", name: "b", last_session_at: new Date().toISOString() }),
    ]);
    const byName = new Map(bodyRows().map((cells) => [cells[0], cells[5]]));
    expect(byName.get("a")).toBe("never");
    expect(byName.get("b")).toBe("just now");
  });

  it("chips a project whose folder is gone, and leaves a present one blank", () => {
    mount([
      project({ id: "/gone", name: "gone", exists: false }),
      project({ id: "/here", name: "here", exists: true }),
    ]);
    const byName = new Map(bodyRows().map((cells) => [cells[0], cells[8]]));
    expect(byName.get("gone")).toBe("folder missing");
    expect(byName.get("here")).toBe("");
  });
});

describe("DEFAULT_SORT", () => {
  it("opens on grade, ascending — best grade first", () => {
    expect(DEFAULT_SORT).toEqual({ id: "grade", desc: false });
  });

  it("orders by grade ascending", () => {
    mount([
      project({ id: "/c", name: "c", grade: "F", issue_count: 0 }),
      project({ id: "/a", name: "a", grade: "A", issue_count: 0 }),
      project({ id: "/b", name: "b", grade: "C", issue_count: 0 }),
    ]);
    expect(names()).toEqual(["a", "b", "c"]);
  });

  it("breaks a grade tie with the most open issues first", () => {
    mount([
      project({ id: "/few", name: "few", grade: "B", issue_count: 1 }),
      project({ id: "/many", name: "many", grade: "B", issue_count: 9 }),
      project({ id: "/none", name: "none", grade: "B", issue_count: 0 }),
    ]);
    expect(names()).toEqual(["many", "few", "none"]);
  });

  it("sorts an ungraded project behind every graded one", () => {
    // Asserted on the sort key rather than through a render: the read model
    // defaults a project with no graded file to "F", so `ProjectRow.grade` is
    // typed non-null and no fixture can honestly reach the cell. The sentinel
    // is what keeps the order deterministic if that ever changes.
    expect(gradeKey(project({ grade: null as unknown as Grade }))).toBe("Z");
    expect(gradeKey(project({ grade: "F" }))).toBe("F");
    expect("F" < "Z").toBe(true);
  });
});

describe("buildPills", () => {
  it("offers a chip per grade letter", () => {
    const grade = buildPills([project()]).find((g) => g.id === "grade");
    expect(grade?.options.map((o) => o.id)).toEqual(["A", "B", "C", "D", "F"]);
    expect(grade?.multi).toBe(true);
  });

  it("slices the status chips by issues and by a missing folder", () => {
    const rows = [
      project({ id: "/clean", issue_count: 0, exists: true }),
      project({ id: "/noisy", issue_count: 3, exists: true }),
      project({ id: "/gone", issue_count: 0, exists: false }),
    ];
    const status = buildPills(rows).find((g) => g.id === "status");
    expect(status?.options.map((o) => o.label)).toEqual(["Has issues", "Missing folder"]);
    const [issues, missing] = status!.options;
    expect(rows.filter(issues.predicate).map((r) => r.id)).toEqual(["/noisy"]);
    expect(rows.filter(missing.predicate).map((r) => r.id)).toEqual(["/gone"]);
  });

  it("offers one chip per harness that actually worked somewhere", () => {
    const rows = [
      project({ id: "/a", harness: "claude_code" }),
      project({ id: "/b", harness: "claude_code" }),
      project({ id: "/c", harness: null }),
    ];
    const harness = buildPills(rows).find((g) => g.id === "harness");
    expect(harness?.options.map((o) => o.label)).toEqual(["Claude Code"]);
    expect(rows.filter(harness!.options[0].predicate).map((r) => r.id)).toEqual(["/a", "/b"]);
  });

  it("drops the harness group when no project has one", () => {
    const groups = buildPills([project({ harness: null })]);
    expect(groups.map((g) => g.id)).toEqual(["grade", "status"]);
  });
});

describe("harnessLabel", () => {
  it("reads a snake_cased harness id as words", () => {
    expect(harnessLabel("claude_code")).toBe("Claude Code");
  });

  it("leaves an id it cannot improve on alone", () => {
    expect(harnessLabel("cursor")).toBe("Cursor");
  });
});
