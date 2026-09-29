import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen, within } from "@testing-library/react";
import type { Grade, ProjectRow } from "@/lib/ipc";
import { DataTable } from "@/components/DataTable";
import { DEFAULT_SORT, projectColumns, type ProjectsColumnsCtx, buildPills, gradeKey, harnessLabel } from "./projects.columns";

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

const ctx: ProjectsColumnsCtx = { setup: null, sessions90: new Map([["/code/web", 7]]) };

let mountCount = 0;

/**
 * Mounts a real `DataTable` with the project column defs — the only faithful
 * way to see what a cell renders. `stateKey` is suffixed with a counter so
 * each render gets its own `sessionStorage` slot; `DataTable` persists sort
 * and search state under `pj.table.<key>`.
 */
function mount(rows: ProjectRow[], sort: { id: string; desc: boolean } = DEFAULT_SORT) {
  mountCount += 1;
  return render(
    <DataTable
      columns={projectColumns(ctx)}
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

describe("projectColumns", () => {
  it("has exactly the spec's columns, in order (§7), and no Findings column", () => {
    expect(projectColumns(ctx).map((c) => c.header)).toEqual([
      "Name", "Grade", "Instructions", "Items available", "Sessions (90 days)", "Last session", "Never used", "Erroring",
    ]);
    expect(projectColumns(ctx).map((c) => c.id)).not.toContain("issues");
    expect(projectColumns(ctx).map((c) => c.id)).not.toContain("status");
  });

  it("counts sessions in the 90-day window, 0 where none started", () => {
    const col = projectColumns(ctx).find((c) => c.id === "sessions") as unknown as { accessorFn: (r: ProjectRow) => number };
    expect(col.accessorFn({ id: "/code/web" } as ProjectRow)).toBe(7);
    expect(col.accessorFn({ id: "/code/api" } as ProjectRow)).toBe(0);
  });

  it("is identity-stable per ctx", () => {
    expect(projectColumns(ctx)).toBe(projectColumns(ctx));
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
    mount([project({ id: "/code/web", file_count: 7, never_used_count: 2, error_count: 5 })]);
    const cells = bodyRows()[0];
    expect(cells[2]).toBe("7");
    expect(cells[4]).toBe("7");
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
});

describe("DEFAULT_SORT", () => {
  it("opens on last session, newest first", () => {
    expect(DEFAULT_SORT).toEqual({ id: "lastSession", desc: true });
  });

  it("orders by last session, newest first, never-used-at-all last", () => {
    mount([
      project({ id: "/n", name: "never", last_session_at: null }),
      project({ id: "/o", name: "old", last_session_at: "2026-01-01T00:00:00.000Z" }),
      project({ id: "/w", name: "new", last_session_at: "2026-09-01T00:00:00.000Z" }),
    ]);
    expect(names()).toEqual(["new", "old", "never"]);
  });

  it("orders by grade ascending when the grade header is chosen", () => {
    mount(
      [
        project({ id: "/c", name: "c", grade: "F", issue_count: 0 }),
        project({ id: "/a", name: "a", grade: "A", issue_count: 0 }),
        project({ id: "/b", name: "b", grade: "C", issue_count: 0 }),
      ],
      { id: "grade", desc: false },
    );
    expect(names()).toEqual(["a", "b", "c"]);
  });

  it("breaks a grade tie with the most open issues first", () => {
    mount(
      [
        project({ id: "/few", name: "few", grade: "B", issue_count: 1 }),
        project({ id: "/many", name: "many", grade: "B", issue_count: 9 }),
        project({ id: "/none", name: "none", grade: "B", issue_count: 0 }),
      ],
      { id: "grade", desc: false },
    );
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
