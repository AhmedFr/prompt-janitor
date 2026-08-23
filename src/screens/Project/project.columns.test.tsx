import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, within } from "@testing-library/react";
import type { ArtifactView, FileRow, UsageStat } from "@/lib/ipc";
import { DataTable } from "@/components/DataTable";
import type { ColumnsCtx } from "@/screens/Setup/setup.columns";
import { PROJECT_RULE_COLUMNS, RULES_DEFAULT_SORT, projectSetupColumns } from "./project.columns";

const openExternal = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/open-external", () => ({ openExternal }));

afterEach(cleanup);

const file = (o: Partial<FileRow> = {}): FileRow => ({
  id: "/code/app/CLAUDE.md",
  name: "CLAUDE.md",
  path: "/code/app/CLAUDE.md",
  project: "app",
  project_id: "/code/app",
  kind: "CLAUDE.md",
  grade: "B",
  score: 80,
  issue_count: 3,
  modified: String(Math.floor(Date.now() / 1000) - 7200),
  ...o,
});

const usage = (o: Partial<UsageStat> = {}): UsageStat => ({
  total: 9,
  sessions: 4,
  last_used: "2026-08-19T10:00:00.000Z",
  error_rate: 0.5,
  avg_turn_tokens: 800,
  count_30d: 2,
  count_prev_30d: 1,
  ...o,
});

const artifact = (o: Partial<ArtifactView> = {}): ArtifactView => ({
  id: 1,
  harness: "claude_code",
  layer: "project",
  kind: "skill",
  name: "pdf-extract",
  path: "/code/app/.claude/skills/pdf-extract/SKILL.md",
  plugin_name: null,
  description: null,
  bytes: 2048,
  grade: null,
  score: null,
  file_id: null,
  usage: null,
  ...o,
});

const ctx = (o: Partial<ColumnsCtx> = {}): ColumnsCtx => ({
  onOpen: vi.fn(),
  projectNames: new Map(),
  ...o,
});

let mountCount = 0;

/** Mounts a real `DataTable`: the only faithful way to see what a cell renders. */
function mount<Row>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: any[],
  rows: Row[],
  rowId: (r: Row) => string,
  extra: { defaultSort?: { id: string; desc: boolean }; onRowClick?: (r: Row) => void } = {},
) {
  mountCount += 1;
  return render(
    <DataTable
      columns={columns}
      rows={rows}
      rowId={rowId}
      empty={{ title: "Nothing here" }}
      stateKey={`test-project-${mountCount}`}
      ariaLabel="Rows"
      {...extra}
    />,
  );
}

/** Header labels in render order. */
function headers(): string[] {
  return screen
    .getAllByRole("columnheader")
    .map((th) => th.textContent?.replace(/[▲▼↕]/g, "").trim() ?? "");
}

/** The first cell of every body row, in render order. */
function firstCells(): string[] {
  return within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((tr) => tr.querySelectorAll("td")[0]?.textContent ?? "");
}

describe("PROJECT_RULE_COLUMNS", () => {
  const rowId = (r: FileRow) => r.id;

  it("lists the five columns the project's rule files are read by", () => {
    mount(PROJECT_RULE_COLUMNS, [file()], rowId);
    expect(headers()).toEqual(["Name", "Kind", "Grade", "Issues", "Modified"]);
  });

  it("renders the file's name, kind, grade and open issue count", () => {
    mount(
      PROJECT_RULE_COLUMNS,
      [file({ name: "AGENTS.md", kind: "AGENTS.md", grade: "D", issue_count: 7 })],
      rowId,
    );
    expect(firstCells()).toEqual(["AGENTS.md"]);
    // Name and Kind both read "AGENTS.md" — the kind *is* the file name here.
    expect(screen.getAllByText("AGENTS.md")).toHaveLength(2);
    expect(screen.getByLabelText("Grade D")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("renders the modified time as a relative age", () => {
    mount(PROJECT_RULE_COLUMNS, [file()], rowId);
    expect(screen.getByText("2h")).toBeInTheDocument();
  });

  it("renders an em dash for a file with no recorded mtime", () => {
    mount(PROJECT_RULE_COLUMNS, [file({ modified: null })], rowId);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("defaults to the noisiest file first", () => {
    mount(
      PROJECT_RULE_COLUMNS,
      [file({ id: "a", name: "quiet", issue_count: 0 }), file({ id: "b", name: "loud", issue_count: 9 })],
      rowId,
      { defaultSort: RULES_DEFAULT_SORT },
    );
    expect(firstCells()).toEqual(["loud", "quiet"]);
  });

  it("is one module-level array, so the table never rebuilds its column model", () => {
    expect(PROJECT_RULE_COLUMNS).toBe(PROJECT_RULE_COLUMNS);
  });
});

describe("projectSetupColumns", () => {
  const rowId = (r: ArtifactView) => String(r.id);

  it("replaces Scope with Kind — every row is in this one project", () => {
    mount(projectSetupColumns(ctx()), [artifact()], rowId);
    expect(headers()).toEqual(["Kind", "Name", "Uses", "Error %", "Avg tokens", "Size", "Actions"]);
    expect(screen.queryByRole("columnheader", { name: /Scope/ })).not.toBeInTheDocument();
  });

  it("pills each row with the kind it is", () => {
    mount(projectSetupColumns(ctx()), [artifact({ kind: "mcp_server", name: "github" })], rowId);
    const pill = screen.getByText("MCP");
    expect(pill).toHaveClass("project-kind");
    expect(pill).toHaveAttribute("data-kind", "mcp_server");
  });

  it("groups the table by kind in the inventory's own order", () => {
    mount(
      projectSetupColumns(ctx()),
      [
        artifact({ id: 1, kind: "settings", name: "settings.json" }),
        artifact({ id: 2, kind: "rule", name: "CLAUDE.md" }),
        artifact({ id: 3, kind: "skill", name: "pdf-extract" }),
      ],
      rowId,
      { defaultSort: { id: "kind", desc: false } },
    );
    expect(firstCells()).toEqual(["Rule", "Skill", "Settings"]);
  });

  it("shows settings files — hooks, permissions and MCP wiring live there", () => {
    mount(projectSetupColumns(ctx()), [artifact({ kind: "settings", name: "settings.json" })], rowId);
    expect(screen.getByText("settings.json")).toBeInTheDocument();
  });

  it("reports usage for the kinds an agent can invoke", () => {
    mount(projectSetupColumns(ctx()), [artifact({ kind: "skill", usage: usage() })], rowId);
    expect(screen.getByText(/used 9×/)).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("800")).toBeInTheDocument();
  });

  it("makes no usage claim about a kind nothing invokes", () => {
    mount(projectSetupColumns(ctx()), [artifact({ kind: "rule", name: "CLAUDE.md" })], rowId);
    expect(screen.queryByText("never used")).not.toBeInTheDocument();
  });

  it("opens a rule row's graded file, and a plugin row's folder", () => {
    const onOpen = vi.fn();
    mount(
      projectSetupColumns(ctx({ onOpen })),
      [
        artifact({ id: 1, kind: "rule", name: "CLAUDE.md", file_id: "f1" }),
        artifact({ id: 2, kind: "plugin", name: "office", path: "/code/app/.claude/plugins/office" }),
      ],
      rowId,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open CLAUDE.md" }));
    expect(onOpen).toHaveBeenCalledWith("f1");

    fireEvent.click(screen.getByRole("button", { name: "Open folder office" }));
    expect(openExternal).toHaveBeenCalledWith("/code/app/.claude/plugins/office");
  });

  it("is identity-stable per context, so a keystroke never rebuilds the column model", () => {
    const c = ctx();
    expect(projectSetupColumns(c)).toBe(projectSetupColumns(c));
    expect(projectSetupColumns(ctx())).not.toBe(projectSetupColumns(c));
  });
});
