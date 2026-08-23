import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, within } from "@testing-library/react";
import type { FileRow } from "@/lib/ipc";
import { DataTable } from "@/components/DataTable";
import { OTHER_PROJECT_ID, OTHER_PROJECT_LABEL, PROJECT_PILL_LIMIT } from "./Prompts.constants";
import { DEFAULT_SORT, buildColumns, buildPills, projectFacets } from "./prompts.columns";

afterEach(cleanup);

const DAY = 86_400;
const nowSecs = () => Math.floor(Date.now() / 1000);

const file = (o: Partial<FileRow> = {}): FileRow => ({
  id: "/code/api/CLAUDE.md",
  name: "CLAUDE.md",
  path: "/code/api/CLAUDE.md",
  project: "api",
  project_id: "/code/api",
  kind: "CLAUDE.md",
  grade: "B",
  score: 80,
  issue_count: 2,
  modified: String(nowSecs() - 3 * DAY),
  ...o,
});

/** A project's worth of files, so the Project pill has something to rank. */
const filesFor = (name: string, count: number, o: Partial<FileRow> = {}): FileRow[] =>
  Array.from({ length: count }, (_, i) =>
    file({
      id: `/code/${name}/f${i}.md`,
      name: `f${i}.md`,
      path: `/code/${name}/f${i}.md`,
      project: name,
      project_id: `/code/${name}`,
      ...o,
    }),
  );

let mountCount = 0;

/** Mounts a real `DataTable` with the prompt column defs — the only faithful way to see what a cell renders. */
function mount(rows: FileRow[], onOpenProject = vi.fn()) {
  mountCount += 1;
  const view = render(
    <DataTable
      columns={buildColumns(onOpenProject)}
      rows={rows}
      rowId={(r) => r.id}
      empty={{ title: "Nothing here" }}
      stateKey={`test-prompts-${mountCount}`}
      ariaLabel="Prompt files"
      defaultSort={DEFAULT_SORT}
    />,
  );
  return { ...view, onOpenProject };
}

/** Every body row's cells as text, in render order. */
function bodyRows(): string[][] {
  return within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent ?? ""));
}

describe("buildColumns", () => {
  it("lists the file columns in spec order", () => {
    expect(buildColumns(vi.fn()).map((c) => c.id)).toEqual([
      "name",
      "project",
      "kind",
      "grade",
      "issues",
      "modified",
    ]);
  });

  it("headers the columns the way the spec names them", () => {
    expect(buildColumns(vi.fn()).map((c) => c.header)).toEqual([
      "Name",
      "Project",
      "Kind",
      "Grade",
      "Issues",
      "Modified",
    ]);
  });

  it("renders the file name over its path — two CLAUDE.md rows are told apart by nothing else", () => {
    mount([file()]);
    const cells = bodyRows()[0];
    expect(cells[0]).toContain("CLAUDE.md");
    expect(cells[0]).toContain("/code/api/CLAUDE.md");
  });

  it("marks the row with its provider", () => {
    mount([file({ kind: "AGENTS.md" })]);
    expect(screen.getByRole("img", { name: "Agents" })).toBeInTheDocument();
  });

  it("renders kind, grade, issue count and a relative mtime", () => {
    mount([file({ kind: "AGENTS.md", grade: "D", issue_count: 7 })]);
    const [, , kind, grade, issues, modified] = bodyRows()[0];
    expect(kind).toBe("AGENTS.md");
    expect(grade).toContain("D");
    expect(issues).toBe("7");
    expect(modified).toBe("3d");
  });

  it("says nothing rather than a wrong age for a file with no recorded mtime", () => {
    mount([file({ modified: null })]);
    expect(bodyRows()[0][5]).toBe("—");
  });

  it("opens the owning project from the project chip", () => {
    const { onOpenProject } = mount([file()]);
    fireEvent.click(screen.getByRole("button", { name: /Open project api/ }));
    expect(onOpenProject).toHaveBeenCalledWith("/code/api");
  });

  it("sorts newest first when the Modified header is read descending", () => {
    mount([
      file({ id: "/old", path: "/old", name: "old.md", modified: String(nowSecs() - 30 * DAY) }),
      file({ id: "/new", path: "/new", name: "new.md", modified: String(nowSecs() - 60) }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: /Modified/ }));
    fireEvent.click(screen.getByRole("button", { name: /Modified/ }));
    expect(bodyRows().map((cells) => cells[5])).toEqual(["1m", "30d"]);
  });
});

describe("DEFAULT_SORT", () => {
  it("leads with the noisiest file — the reason to open this table at all", () => {
    expect(DEFAULT_SORT).toEqual({ id: "issues", desc: true });
  });
});

describe("projectFacets", () => {
  it("ranks projects by how many files they contribute, then by name", () => {
    const rows = [...filesFor("web", 3), ...filesFor("api", 1), ...filesFor("cli", 1)];
    expect(projectFacets(rows).map((f) => [f.name, f.count])).toEqual([
      ["web", 3],
      ["api", 1],
      ["cli", 1],
    ]);
  });
});

describe("buildPills", () => {
  const mixed = [
    ...filesFor("web", 2, { kind: "CLAUDE.md", grade: "A", issue_count: 0 }),
    ...filesFor("api", 1, { kind: "AGENTS.md", grade: "F", issue_count: 4 }),
  ];

  it("offers Kind, Grade, Project and Status, in that order", () => {
    expect(buildPills(mixed).map((g) => g.id)).toEqual(["kind", "grade", "project", "status"]);
    expect(buildPills(mixed).map((g) => g.label)).toEqual(["Kind", "Grade", "Project", "Status"]);
  });

  const groupOf = (rows: FileRow[], id: string, pinned?: string) =>
    buildPills(rows, pinned).find((g) => g.id === id);

  it("derives a Kind chip per kind actually scanned", () => {
    const kinds = groupOf(mixed, "kind");
    expect(kinds?.options.map((o) => o.id)).toEqual(["AGENTS.md", "CLAUDE.md"]);
  });

  it("drops the Kind group when every file is the same kind — a chip nothing excludes is furniture", () => {
    expect(groupOf(filesFor("web", 3), "kind")).toBeUndefined();
  });

  it("includes and excludes by kind", () => {
    const kind = groupOf(mixed, "kind")?.options.find((o) => o.id === "AGENTS.md");
    expect(kind?.predicate(mixed[2])).toBe(true);
    expect(kind?.predicate(mixed[0])).toBe(false);
  });

  it("offers every grade, matched or not", () => {
    expect(groupOf(mixed, "grade")?.options.map((o) => o.id)).toEqual(["A", "B", "C", "D", "F"]);
  });

  it("includes and excludes by grade", () => {
    const f = groupOf(mixed, "grade")?.options.find((o) => o.id === "F");
    expect(f?.predicate(mixed[2])).toBe(true);
    expect(f?.predicate(mixed[0])).toBe(false);
  });

  it("includes and excludes by project", () => {
    const web = groupOf(mixed, "project")?.options.find((o) => o.id === "/code/web");
    expect(web?.predicate(mixed[0])).toBe(true);
    expect(web?.predicate(mixed[2])).toBe(false);
  });

  it("includes and excludes by open issues", () => {
    const hasIssues = groupOf(mixed, "status")?.options.find((o) => o.id === "issues");
    expect(hasIssues?.label).toBe("Has issues");
    expect(hasIssues?.predicate(mixed[2])).toBe(true);
    expect(hasIssues?.predicate(mixed[0])).toBe(false);
  });

  /** Thirteen projects, each with one more file than the last, so the ranking is unambiguous. */
  const manyProjects = Array.from({ length: PROJECT_PILL_LIMIT + 1 }, (_, i) =>
    filesFor(`p${String(i).padStart(2, "0")}`, i + 1),
  ).flat();

  it("chips only the twelve busiest projects, and buckets the rest under Other", () => {
    const options = groupOf(manyProjects, "project")?.options ?? [];
    expect(options).toHaveLength(PROJECT_PILL_LIMIT + 1);
    expect(options[options.length - 1]).toMatchObject({
      id: OTHER_PROJECT_ID,
      label: OTHER_PROJECT_LABEL,
    });
    // p00 has the fewest files, so it is the one squeezed out.
    expect(options.map((o) => o.id)).not.toContain("/code/p00");
  });

  it("matches exactly the projects no chip of its own names, under Other", () => {
    const other = groupOf(manyProjects, "project")?.options.find((o) => o.id === OTHER_PROJECT_ID);
    expect(other?.predicate(file({ project_id: "/code/p00" }))).toBe(true);
    expect(other?.predicate(file({ project_id: "/code/p12" }))).toBe(false);
  });

  it("has no Other bucket when every project already has a chip", () => {
    const options = groupOf(mixed, "project")?.options ?? [];
    expect(options.map((o) => o.id)).not.toContain(OTHER_PROJECT_ID);
  });

  it("pins a deep-linked project that the ranking would have left out", () => {
    // Without this the deep link would select a chip that does not exist, and
    // the table would quietly show every file instead of that project's.
    const options = groupOf(manyProjects, "project", "/code/p00")?.options ?? [];
    expect(options.map((o) => o.id)).toContain("/code/p00");
    // p00 was the only project outside the ranking, so pinning it leaves the
    // Other bucket with nothing to hold — and an empty bucket is furniture.
    expect(options.map((o) => o.id)).not.toContain(OTHER_PROJECT_ID);
  });

  it("keeps the Other bucket for the projects a pin does not rescue", () => {
    const rows = [...manyProjects, ...filesFor("p13", 1)];
    const options = groupOf(rows, "project", "/code/p00")?.options ?? [];
    const other = options.find((o) => o.id === OTHER_PROJECT_ID);
    expect(other?.predicate(file({ project_id: "/code/p13" }))).toBe(true);
    expect(other?.predicate(file({ project_id: "/code/p00" }))).toBe(false);
  });

  it("does not duplicate a pinned project that already has a chip", () => {
    const options = groupOf(mixed, "project", "/code/web")?.options ?? [];
    expect(options.filter((o) => o.id === "/code/web")).toHaveLength(1);
  });

  it("drops the Project group when every file belongs to the same project", () => {
    expect(groupOf(filesFor("web", 3), "project")).toBeUndefined();
  });
});
