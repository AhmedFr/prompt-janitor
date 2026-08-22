import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "./DataTable";
import { ActionsCell } from "./cells";
import type { DataTableProps, PillGroup } from "./DataTable.types";

interface Row {
  id: string;
  name: string;
  kind: string;
  score: number;
}

const ROWS: Row[] = [
  { id: "1", name: "Alpha", kind: "rule", score: 3 },
  { id: "2", name: "Bravo", kind: "prompt", score: 1 },
  { id: "3", name: "Charlie", kind: "rule", score: 2 },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COLUMNS: ColumnDef<Row, any>[] = [
  { id: "name", header: "Name", accessorKey: "name" },
  { id: "kind", header: "Kind", accessorKey: "kind", enableSorting: false },
  { id: "score", header: "Score", accessorKey: "score", meta: { align: "right" } },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ACTIONS_COLUMN: ColumnDef<Row, any> = {
  id: "actions",
  header: "Actions",
  enableSorting: false,
  meta: { align: "right", interactive: true },
  cell: () => <ActionsCell actions={[{ label: "Delete", icon: "x", onClick: vi.fn() }]} />,
};

const PILLS: PillGroup<Row>[] = [
  {
    id: "kind",
    label: "Kind",
    multi: true,
    options: [
      { id: "rule", label: "Rules", predicate: (r) => r.kind === "rule" },
      { id: "prompt", label: "Prompts", predicate: (r) => r.kind === "prompt" },
    ],
  },
];

function setup(overrides: Partial<DataTableProps<Row>> = {}) {
  const props: DataTableProps<Row> = {
    columns: COLUMNS,
    rows: ROWS,
    rowId: (r) => r.id,
    empty: { title: "No artifacts yet", hint: "Run a scan to populate this table." },
    stateKey: "test",
    ariaLabel: "Artifacts",
    ...overrides,
  };
  return { ...render(<DataTable {...props} />), props };
}

/** The first-column text of every body row, in render order. */
function rowNames(): string[] {
  const body = screen.getAllByRole("rowgroup")[1];
  return within(body)
    .queryAllByRole("row")
    .map((tr) => tr.querySelectorAll("td")[0]?.textContent ?? "");
}

beforeEach(() => window.sessionStorage.clear());
afterEach(cleanup);

describe("DataTable", () => {
  it("renders a labelled table with one row per item", () => {
    setup();
    expect(screen.getByRole("table", { name: "Artifacts" })).toBeInTheDocument();
    expect(rowNames()).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("renders a header button only for sortable columns", () => {
    setup();
    const head = screen.getAllByRole("rowgroup")[0];
    expect(within(head).getByRole("button", { name: /Name/ })).toBeInTheDocument();
    expect(within(head).getByRole("button", { name: /Score/ })).toBeInTheDocument();
    expect(within(head).queryByRole("button", { name: /Kind/ })).not.toBeInTheDocument();
  });

  it("cycles a header through ascending, descending and unsorted", () => {
    setup();
    const header = screen.getByRole("columnheader", { name: /Score/ });
    expect(header).toHaveAttribute("aria-sort", "none");

    fireEvent.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(rowNames()).toEqual(["Bravo", "Charlie", "Alpha"]);

    fireEvent.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(rowNames()).toEqual(["Alpha", "Charlie", "Bravo"]);

    fireEvent.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "none");
    expect(rowNames()).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("starts from defaultSort when one is given", () => {
    setup({ defaultSort: { id: "name", desc: true } });
    expect(rowNames()).toEqual(["Charlie", "Bravo", "Alpha"]);
    expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute("aria-sort", "descending");
  });

  it("filters on the search box, debounced so typing does not thrash the table", async () => {
    setup({ search: { placeholder: "Search artifacts", keys: ["name"] } });

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "brav" } });
    expect(rowNames()).toEqual(["Alpha", "Bravo", "Charlie"]);

    await waitFor(() => expect(rowNames()).toEqual(["Bravo"]));
  });

  it("renders each pill group as toggle buttons carrying their match counts", () => {
    setup({ pills: PILLS });
    const group = screen.getByRole("group", { name: "Kind" });
    const rules = within(group).getByRole("button", { name: /Rules/ });
    expect(rules).toHaveAttribute("aria-pressed", "false");
    expect(rules).toHaveTextContent("2");
    expect(within(group).getByRole("button", { name: /Prompts/ })).toHaveTextContent("1");
  });

  it("filters to the selected pills and marks them pressed", () => {
    setup({ pills: PILLS });
    const rules = screen.getByRole("button", { name: /Rules/ });

    fireEvent.click(rules);
    expect(rules).toHaveAttribute("aria-pressed", "true");
    expect(rowNames()).toEqual(["Alpha", "Charlie"]);

    fireEvent.click(screen.getByRole("button", { name: /Prompts/ }));
    expect(rowNames()).toEqual(["Alpha", "Bravo", "Charlie"]);

    fireEvent.click(rules);
    expect(rules).toHaveAttribute("aria-pressed", "false");
    expect(rowNames()).toEqual(["Bravo"]);
  });

  it("makes rows button-like when onRowClick is set", () => {
    setup({ onRowClick: vi.fn() });
    const row = screen.getByRole("button", { name: /Alpha/ });
    expect(row.tagName).toBe("TR");
    expect(row).toHaveAttribute("tabindex", "0");
  });

  it("leaves rows inert when there is no onRowClick", () => {
    setup();
    const body = screen.getAllByRole("rowgroup")[1];
    expect(within(body).queryAllByRole("button")).toHaveLength(0);
  });

  it("opens a row on click, Enter and Space", () => {
    const onRowClick = vi.fn();
    setup({ onRowClick });
    const row = screen.getByRole("button", { name: /Alpha/ });

    fireEvent.click(row);
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });

    expect(onRowClick).toHaveBeenCalledTimes(3);
    expect(onRowClick).toHaveBeenLastCalledWith(ROWS[0]);
  });

  it("shows the caller's empty copy when there is nothing to list at all", () => {
    setup({ rows: [] });
    expect(screen.getByText("No artifacts yet")).toBeInTheDocument();
    expect(screen.getByText("Run a scan to populate this table.")).toBeInTheDocument();
  });

  it("offers a clear-filters escape hatch when filters match nothing", async () => {
    setup({ search: { placeholder: "Search artifacts", keys: ["name"] }, pills: PILLS });

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    await waitFor(() => expect(screen.getByText(/No rows match/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(rowNames()).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("counts the visible slice against the whole set only while filtered", () => {
    setup({ pills: PILLS });
    expect(screen.queryByText(/of 3 rows/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Prompts/ }));
    expect(screen.getByText("1 of 3 rows")).toBeInTheDocument();
  });

  it("remembers search, pills and sort per table key across remounts", async () => {
    const { unmount } = setup({ search: { placeholder: "Search", keys: ["name"] }, pills: PILLS });

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "a" } });
    fireEvent.click(screen.getByRole("button", { name: /Rules/ }));
    fireEvent.click(within(screen.getByRole("columnheader", { name: /Name/ })).getByRole("button"));
    await waitFor(() => expect(window.sessionStorage.getItem("pj.table.test")).toContain('"a"'));

    unmount();
    setup({ search: { placeholder: "Search", keys: ["name"] }, pills: PILLS });

    expect(screen.getByRole("searchbox")).toHaveValue("a");
    expect(screen.getByRole("button", { name: /Rules/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute("aria-sort", "ascending");
  });

  it("marks numeric columns as right-aligned", () => {
    setup();
    const cell = screen.getAllByRole("rowgroup")[1].querySelectorAll("td")[2];
    expect(cell).toHaveClass("dt__cell--right");
  });

  it("applies the compact density class", () => {
    const { container } = setup({ density: "compact" });
    expect(container.querySelector(".dt")).toHaveClass("dt--compact");
  });

  it("renders every row when virtualisation is on but the set is small", () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({
      id: String(i),
      name: `Row ${i}`,
      kind: "rule",
      score: i,
    }));
    setup({ rows, virtualize: true });
    expect(rowNames()).toHaveLength(50);
  });

  it("renders only a window of rows when virtualising a large set", () => {
    // The virtualiser sizes its scroll container from offsetWidth/offsetHeight,
    // which jsdom always reports as 0 — without this the window is empty.
    const sized = (name: string, value: number) =>
      Object.defineProperty(HTMLElement.prototype, name, { configurable: true, value });
    sized("offsetWidth", 800);
    sized("offsetHeight", 300);
    try {
      const rows = Array.from({ length: 500 }, (_, i) => ({
        id: String(i),
        name: `Row ${i}`,
        kind: "rule",
        score: i,
      }));
      const { container } = setup({ rows, virtualize: true });
      const rendered = container.querySelectorAll("tbody tr[data-row-id]");
      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered.length).toBeLessThan(100);
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "offsetWidth");
      Reflect.deleteProperty(HTMLElement.prototype, "offsetHeight");
    }
  });

  it("has no axe violations", async () => {
    const { container } = setup({
      search: { placeholder: "Search artifacts", keys: ["name"] },
      pills: PILLS,
      toolbarRight: <button type="button">Add rule</button>,
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no axe violations with clickable rows", async () => {
    const { container } = setup({ onRowClick: vi.fn() });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("keeps a clickable row out of the button role when a column renders its own controls", () => {
    const onRowClick = vi.fn();
    setup({ columns: [...COLUMNS, ACTIONS_COLUMN], onRowClick });

    const row = screen.getAllByRole("rowgroup")[1].querySelector("tr[data-row-id]") as HTMLElement;
    expect(row).not.toHaveAttribute("role");
    expect(row).toHaveAttribute("tabindex", "0");
    expect(row).toHaveAttribute("aria-label", "Alpha");

    fireEvent.keyDown(row, { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
  });

  it("has no axe violations when clickable rows carry row actions", async () => {
    const { container } = setup({ columns: [...COLUMNS, ACTIONS_COLUMN], onRowClick: vi.fn() });
    expect(await axe(container)).toHaveNoViolations();
  });
});
