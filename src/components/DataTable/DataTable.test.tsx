import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, render, cleanup, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "./DataTable";
import { ActionsCell } from "./cells";
import { ROW_HEIGHT, SEARCH_DEBOUNCE_MS } from "./DataTable.constants";
import type { DataTableProps, PillGroup } from "./DataTable.types";

// Passes straight through to the real virtualiser, only counting `measure()`
// so the density re-measure can be asserted from outside the component.
const virtual = vi.hoisted(() => ({ measures: 0, wrapped: new WeakSet<object>() }));
vi.mock("@tanstack/react-virtual", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-virtual")>();
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useVirtualizer: (options: any) => {
      const instance = actual.useVirtualizer(options);
      if (!virtual.wrapped.has(instance)) {
        virtual.wrapped.add(instance);
        const original = instance.measure.bind(instance);
        instance.measure = () => {
          virtual.measures += 1;
          original();
        };
      }
      return instance;
    },
  };
});

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

const onAction = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ACTIONS_COLUMN: ColumnDef<Row, any> = {
  id: "actions",
  header: "Actions",
  enableSorting: false,
  meta: { align: "right" },
  cell: () => <ActionsCell actions={[{ label: "Delete", icon: "x", onClick: onAction }]} />,
};

/** A control that does *not* stop propagation — the row guard has to do the work. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TOGGLE_COLUMN: ColumnDef<Row, any> = {
  id: "toggle",
  header: "Toggle",
  enableSorting: false,
  cell: () => (
    <button type="button" onClick={onAction}>
      Toggle
    </button>
  ),
};

/** Counts how often the body re-renders, from inside a cell. */
const cellRenders = { count: 0 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COUNTING_COLUMN: ColumnDef<Row, any> = {
  id: "counted",
  header: "Counted",
  enableSorting: false,
  cell: () => {
    cellRenders.count += 1;
    return <span>·</span>;
  },
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

/** Two groups, so "faceted" has another group's selection to be faceted by. */
const TWO_GROUPS: PillGroup<Row>[] = [
  PILLS[0],
  {
    id: "score",
    label: "Score",
    options: [
      { id: "low", label: "Low", predicate: (r) => r.score < 3 },
      { id: "high", label: "High", predicate: (r) => r.score >= 3 },
    ],
  },
];

const SEARCH = { placeholder: "Search artifacts", keys: ["name" as const] };

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

const firstRow = () =>
  screen.getAllByRole("rowgroup")[1].querySelector("tr[data-row-id]") as HTMLElement;

/**
 * The virtualiser sizes its scroll container from offsetWidth/offsetHeight and
 * each row from getBoundingClientRect — jsdom reports 0 for all three, which
 * would collapse the window to nothing.
 */
function withSizedDom(rowHeight: number, body: () => void) {
  const define = (name: string, value: number) =>
    Object.defineProperty(HTMLElement.prototype, name, { configurable: true, value });
  const rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    width: 800,
    height: rowHeight,
    top: 0,
    left: 0,
    bottom: rowHeight,
    right: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  define("offsetWidth", 800);
  define("offsetHeight", 300);
  try {
    body();
  } finally {
    rect.mockRestore();
    Reflect.deleteProperty(HTMLElement.prototype, "offsetWidth");
    Reflect.deleteProperty(HTMLElement.prototype, "offsetHeight");
  }
}

const manyRows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: String(i), name: `Row ${i}`, kind: "rule", score: i }));

beforeEach(() => {
  window.sessionStorage.clear();
  onAction.mockClear();
  virtual.measures = 0;
  cellRenders.count = 0;
});
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

  it("names a pill by its label and its count, not by the two run together", () => {
    // Same defect as the tab badges: the count concatenated into the name,
    // so the Rules pill announced as "Rules2".
    setup({ pills: PILLS });
    expect(screen.getByRole("button", { name: "Rules, 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prompts, 1" })).toBeInTheDocument();
  });

  it("prefers a precomputed pill count over recounting the rows", () => {
    setup({
      pills: [
        {
          id: "kind",
          label: "Kind",
          options: [{ id: "rule", label: "Rules", predicate: () => false, count: 42 }],
        },
      ],
    });
    expect(screen.getByRole("button", { name: /Rules/ })).toHaveTextContent("42");
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

  it("makes rows focusable and named when onRowClick is set", () => {
    setup({ onRowClick: vi.fn() });
    const row = firstRow();
    expect(row).toHaveAttribute("tabindex", "0");
    expect(row).toHaveAttribute("aria-label", "Alpha");
  });

  it("never gives a row the button role, so row actions stay reachable", () => {
    setup({ columns: [...COLUMNS, ACTIONS_COLUMN], onRowClick: vi.fn() });
    expect(firstRow()).not.toHaveAttribute("role");
  });

  it("labels a row with rowLabel when the caller supplies one", () => {
    setup({ onRowClick: vi.fn(), rowLabel: (r) => `${r.name} (${r.kind})` });
    expect(firstRow()).toHaveAttribute("aria-label", "Alpha (rule)");
  });

  it("falls back to the row id when the first cell has nothing to say", () => {
    setup({
      columns: [{ id: "blank", header: "Blank", cell: () => null, enableSorting: false }, ...COLUMNS],
      onRowClick: vi.fn(),
    });
    expect(firstRow()).toHaveAttribute("aria-label", "1");
  });

  it("leaves rows inert when there is no onRowClick", () => {
    setup();
    const body = screen.getAllByRole("rowgroup")[1];
    expect(within(body).queryAllByRole("button")).toHaveLength(0);
  });

  it("opens a row on click, Enter and Space", () => {
    const onRowClick = vi.fn();
    setup({ onRowClick });
    const row = firstRow();

    fireEvent.click(row);
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });

    expect(onRowClick).toHaveBeenCalledTimes(3);
    expect(onRowClick).toHaveBeenLastCalledWith(ROWS[0]);
  });

  it("opens a row when the click lands on a plain cell inside it", () => {
    const onRowClick = vi.fn();
    setup({ columns: [...COLUMNS, ACTIONS_COLUMN], onRowClick });

    fireEvent.click(firstRow().querySelectorAll("td")[0]);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it("does not open the row when a control inside it is clicked", () => {
    const onRowClick = vi.fn();
    setup({ columns: [...COLUMNS, TOGGLE_COLUMN], onRowClick });

    fireEvent.click(within(firstRow()).getByRole("button", { name: "Toggle" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("does not open the row when a row action is clicked", () => {
    const onRowClick = vi.fn();
    setup({ columns: [...COLUMNS, ACTIONS_COLUMN], onRowClick });

    fireEvent.click(within(firstRow()).getByRole("button", { name: "Delete" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("does not open the row when Enter fires a row action", () => {
    const onRowClick = vi.fn();
    setup({ columns: [...COLUMNS, ACTIONS_COLUMN], onRowClick });
    const action = within(firstRow()).getByRole("button", { name: "Delete" });

    // A browser answers Enter on a <button> with keydown *and* a click; jsdom
    // synthesises neither for the other, so both are dispatched here.
    fireEvent.keyDown(action, { key: "Enter" });
    fireEvent.click(action);

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("does not open the row when Space is pressed inside a control", () => {
    const onRowClick = vi.fn();
    setup({ columns: [...COLUMNS, TOGGLE_COLUMN], onRowClick });

    fireEvent.keyDown(within(firstRow()).getByRole("button", { name: "Toggle" }), { key: " " });
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("shows the caller's empty copy when there is nothing to list at all", () => {
    setup({ rows: [] });
    expect(screen.getByText("No artifacts yet")).toBeInTheDocument();
    expect(screen.getByText("Run a scan to populate this table.")).toBeInTheDocument();
  });

  it("ignores a remembered pill whose option no longer exists", () => {
    // The kind pill set can shrink under a table that remembered one of its
    // chips (a project dropped by the last scan, a plugin uninstalled).
    // Applying it would empty the table with no chip pressed to un-press.
    window.sessionStorage.setItem(
      "pj.table.stale-pill",
      JSON.stringify({ search: "", pills: { kind: ["gone"] }, sort: null }),
    );
    setup({ pills: PILLS, stateKey: "stale-pill" });

    expect(rowNames()).toEqual(["Alpha", "Bravo", "Charlie"]);
    expect(screen.queryByText(/No rows match/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rules/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText(/of 3 rows/)).not.toBeInTheDocument();
  });

  it("still applies the live half of a part-stale selection", () => {
    window.sessionStorage.setItem(
      "pj.table.part-stale",
      JSON.stringify({ search: "", pills: { kind: ["rule", "gone"] }, sort: null }),
    );
    setup({ pills: PILLS, stateKey: "part-stale" });

    expect(rowNames()).toEqual(["Alpha", "Charlie"]);
    expect(screen.getByRole("button", { name: /Rules/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("offers a clear-filters escape hatch when filters match nothing", async () => {
    setup({ search: { placeholder: "Search artifacts", keys: ["name"] }, pills: PILLS });

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    await waitFor(() => expect(screen.getByText(/No rows match/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(rowNames()).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("keeps the sort the user chose when clearing filters", async () => {
    setup({ pills: PILLS, search: { placeholder: "Search", keys: ["name"] } });
    const header = () => screen.getByRole("columnheader", { name: /Name/ });

    fireEvent.click(within(header()).getByRole("button"));
    fireEvent.click(within(header()).getByRole("button"));
    fireEvent.click(screen.getByRole("button", { name: /Rules/ }));
    expect(header()).toHaveAttribute("aria-sort", "descending");

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    await waitFor(() => expect(screen.getByText(/No rows match/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    // Search and pills are gone; the sort is the user's reading order, not a filter.
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getByRole("button", { name: /Rules/ })).toHaveAttribute("aria-pressed", "false");
    expect(header()).toHaveAttribute("aria-sort", "descending");
    expect(rowNames()).toEqual(["Charlie", "Bravo", "Alpha"]);
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

  it("pins the row height to the height the virtualiser estimates", () => {
    const heightVar = (el: Element) => (el as HTMLElement).style.getPropertyValue("--dt-row-h");

    const regular = setup();
    expect(heightVar(regular.container.querySelector(".dt") as Element)).toBe(`${ROW_HEIGHT.regular}px`);

    cleanup();
    const compact = setup({ density: "compact" });
    expect(heightVar(compact.container.querySelector(".dt") as Element)).toBe(`${ROW_HEIGHT.compact}px`);
  });

  it("renders every row when virtualisation is on but the set is small", () => {
    setup({ rows: manyRows(50), virtualize: true });
    expect(rowNames()).toHaveLength(50);
  });

  it("renders only a window of rows when virtualising a large set", () => {
    withSizedDom(ROW_HEIGHT.regular, () => {
      const { container } = setup({ rows: manyRows(500), virtualize: true });
      const rendered = container.querySelectorAll("tbody tr[data-row-id]");
      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered.length).toBeLessThan(100);
    });
  });

  it("hands virtualised rows to the measurer and keeps their true position", () => {
    withSizedDom(ROW_HEIGHT.regular, () => {
      const { container } = setup({ rows: manyRows(500), virtualize: true });

      const table = container.querySelector("table") as HTMLElement;
      expect(table).toHaveAttribute("aria-rowcount", "501");

      const first = container.querySelector("tbody tr[data-row-id]") as HTMLElement;
      expect(first).toHaveAttribute("data-index", "0");
      // Header is row 1, so the first body row is row 2.
      expect(first).toHaveAttribute("aria-rowindex", "2");
    });
  });

  it("re-measures the virtualiser when the density changes", () => {
    withSizedDom(ROW_HEIGHT.regular, () => {
      const rows = manyRows(500);
      const props: DataTableProps<Row> = {
        columns: COLUMNS,
        rows,
        rowId: (r) => r.id,
        empty: { title: "none" },
        stateKey: "test",
        ariaLabel: "Artifacts",
        virtualize: true,
      };
      const { rerender } = render(<DataTable {...props} />);

      const afterMount = virtual.measures;
      rerender(<DataTable {...props} />);
      expect(virtual.measures).toBe(afterMount);

      rerender(<DataTable {...props} density="compact" />);
      expect(virtual.measures).toBe(afterMount + 1);
    });
  });

  it("has no axe violations while virtualised", async () => {
    let container!: HTMLElement;
    withSizedDom(ROW_HEIGHT.regular, () => {
      container = setup({ rows: manyRows(500), virtualize: true, onRowClick: vi.fn() }).container;
    });
    expect(await axe(container)).toHaveNoViolations();
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

  it("has no axe violations when clickable rows carry row actions", async () => {
    const { container } = setup({ columns: [...COLUMNS, ACTIONS_COLUMN], onRowClick: vi.fn() });
    expect(await axe(container)).toHaveNoViolations();
  });
  it("hands a group's count off to the chip that owns it", () => {
    setup({ pills: TWO_GROUPS });
    const score = screen.getByRole("group", { name: "Score" });
    expect(within(score).getByRole("button", { name: /Low/ })).toHaveTextContent("2");
    expect(within(score).getByRole("button", { name: /High/ })).toHaveTextContent("1");
  });

  it("counts chips over the searched slice, not the whole table", async () => {
    setup({ pills: PILLS, search: SEARCH });

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "alp" } });
    await waitFor(() => expect(rowNames()).toEqual(["Alpha"]));

    // Alpha is the only match and it is a rule: a "Prompts 1" chip here would
    // promise a row the search has already excluded.
    expect(screen.getByRole("button", { name: /Rules/ })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: /Prompts/ })).toHaveTextContent("0");
  });

  it("counts chips within the other groups' selections", () => {
    setup({ pills: TWO_GROUPS });

    fireEvent.click(screen.getByRole("button", { name: /High/ }));

    // Only Alpha scores >= 3, and it is a rule.
    expect(screen.getByRole("button", { name: /Rules/ })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: /Prompts/ })).toHaveTextContent("0");
  });

  it("keeps a group's own chips counted as if nothing in it were selected", () => {
    setup({ pills: TWO_GROUPS });

    fireEvent.click(screen.getByRole("button", { name: /Rules/ }));

    // Picking Rules must not zero Prompts — that count is the way back out.
    expect(screen.getByRole("button", { name: /Prompts/ })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: /Rules/ })).toHaveTextContent("2");
    // The other group is faceted by the rule selection: Bravo (score 1) is gone.
    expect(screen.getByRole("button", { name: /Low/ })).toHaveTextContent("1");
  });

  it("labels each pill group visibly, not only for assistive tech", () => {
    const { container } = setup({ pills: TWO_GROUPS });
    const labels = [...container.querySelectorAll(".dt__pill-group-label")].map((el) => el.textContent);
    expect(labels).toEqual(["Kind", "Score"]);
    // The visible label is what names the group, so the name is spelled once.
    expect(screen.getByRole("group", { name: "Score" })).toBeInTheDocument();
  });

  it("does not carry a half-typed search onto the next table key", async () => {
    const props: DataTableProps<Row> = {
      columns: COLUMNS,
      rows: ROWS,
      rowId: (r) => r.id,
      empty: { title: "none" },
      stateKey: "tab-a",
      ariaLabel: "Artifacts",
      search: SEARCH,
    };
    const { rerender } = render(<DataTable {...props} />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "brav" } });
    rerender(<DataTable {...props} stateKey="tab-b" />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS * 3));
    });

    expect(window.sessionStorage.getItem("pj.table.tab-b")).toBeNull();
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(rowNames()).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("restores the new key's own remembered search when the key changes", async () => {
    window.sessionStorage.setItem(
      "pj.table.tab-b",
      JSON.stringify({ search: "charl", pills: {}, sort: null }),
    );
    const props: DataTableProps<Row> = {
      columns: COLUMNS,
      rows: ROWS,
      rowId: (r) => r.id,
      empty: { title: "none" },
      stateKey: "tab-a",
      ariaLabel: "Artifacts",
      search: SEARCH,
    };
    const { rerender } = render(<DataTable {...props} />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "brav" } });
    rerender(<DataTable {...props} stateKey="tab-b" />);

    expect(screen.getByRole("searchbox")).toHaveValue("charl");
    await waitFor(() => expect(rowNames()).toEqual(["Charlie"]));
  });

  it("re-renders only the search box while typing, not every row", async () => {
    setup({ columns: [...COLUMNS, COUNTING_COLUMN], search: SEARCH });
    const before = cellRenders.count;
    expect(before).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "brav" } });
    expect(screen.getByRole("searchbox")).toHaveValue("brav");
    // Keystrokes live in the search box until the debounce commits; the body
    // has nothing new to say until then.
    expect(cellRenders.count).toBe(before);

    await waitFor(() => expect(rowNames()).toEqual(["Bravo"]));
    expect(cellRenders.count).toBeGreaterThan(before);
  });

  it("virtualises a large table without being asked to", () => {
    withSizedDom(ROW_HEIGHT.regular, () => {
      const { container } = setup({ rows: manyRows(500) });
      const rendered = container.querySelectorAll("tbody tr[data-row-id]");
      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered.length).toBeLessThan(100);
    });
  });

  it("re-reads a mutated pills array when its group ids change", () => {
    const pills: PillGroup<Row>[] = [PILLS[0]];
    const props: DataTableProps<Row> = {
      columns: COLUMNS,
      rows: ROWS,
      rowId: (r) => r.id,
      empty: { title: "none" },
      stateKey: "test",
      ariaLabel: "Artifacts",
      pills,
    };
    const { rerender } = render(<DataTable {...props} />);

    // Same array identity, new contents — the memo has to notice anyway.
    pills.push(TWO_GROUPS[1]);
    rerender(<DataTable {...props} />);

    expect(screen.getByRole("button", { name: /High/ })).toHaveTextContent("1");
  });

  it("re-reads a mutated search config when its key count changes", async () => {
    const search = { placeholder: "Search artifacts", keys: ["name"] as ("name" | "kind")[] };
    const props: DataTableProps<Row> = {
      columns: COLUMNS,
      rows: ROWS,
      rowId: (r) => r.id,
      empty: { title: "none" },
      stateKey: "test",
      ariaLabel: "Artifacts",
      search,
    };
    const { rerender } = render(<DataTable {...props} />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "prompt" } });
    // "prompt" is Bravo's kind, not its name — nothing matches on name alone.
    await waitFor(() => expect(screen.getByText(/No rows match/)).toBeInTheDocument());

    // Same object identity, one more key — the memo has to notice anyway.
    search.keys.push("kind");
    rerender(<DataTable {...props} />);
    expect(rowNames()).toEqual(["Bravo"]);
  });

  it("marks the highlighted row and scrolls it into view", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    try {
      const { container } = setup({ highlightRowId: "2" });
      const row = container.querySelector(".dt__row--highlight") as HTMLElement;
      expect(row).toHaveAttribute("data-row-id", "2");
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
  });

  it("scrolls to the highlighted row once rows finish loading", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    try {
      const props: DataTableProps<Row> = {
        columns: COLUMNS,
        rows: ROWS,
        rowId: (r) => r.id,
        empty: { title: "No artifacts yet" },
        stateKey: "test",
        ariaLabel: "Artifacts",
        highlightRowId: "2",
        loading: true,
      };
      const { rerender } = render(<DataTable {...props} />);
      // Nothing to scroll to yet — the table hasn't rendered any rows.
      expect(scrollIntoView).not.toHaveBeenCalled();

      rerender(<DataTable {...props} loading={false} />);
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
  });

  it("survives a highlight when the environment has no scrollIntoView", () => {
    expect(() => setup({ highlightRowId: "2" })).not.toThrow();
  });

  it("lets the caller class rows by what is in them", () => {
    const { container } = setup({ rowClassName: (r) => (r.kind === "rule" ? "is-rule" : undefined) });
    const rows = [...container.querySelectorAll("tbody tr[data-row-id]")];
    expect(rows.map((tr) => tr.classList.contains("is-rule"))).toEqual([true, false, true]);
  });

  it("renders a busy skeleton instead of rows while loading", () => {
    const { container } = setup({ loading: true });
    expect(screen.getByRole("table", { name: "Artifacts" })).toHaveAttribute("aria-busy", "true");
    expect(container.querySelectorAll(".dt__skeleton-row")).toHaveLength(5);
    expect(container.querySelectorAll("tbody tr[data-row-id]")).toHaveLength(0);
    // Not "nothing to show" — the table simply doesn't know yet.
    expect(screen.queryByText("No artifacts yet")).not.toBeInTheDocument();
  });

  it("counts nothing while the rows are still loading", () => {
    window.sessionStorage.setItem(
      "pj.table.test",
      JSON.stringify({ search: "alp", pills: {}, sort: null }),
    );
    setup({ loading: true, search: SEARCH });
    expect(screen.queryByText(/of 3 rows/)).not.toBeInTheDocument();
  });

  it("does not claim to be busy once loading is over", () => {
    setup();
    expect(screen.getByRole("table", { name: "Artifacts" })).not.toHaveAttribute("aria-busy");
  });

  it("has no axe violations while loading", async () => {
    const { container } = setup({ loading: true, search: SEARCH, pills: PILLS });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("applies an initial pill selection on mount", async () => {
    setup({ pills: PILLS, initialPills: { kind: ["prompt"] } });

    await waitFor(() => expect(rowNames()).toEqual(["Bravo"]));
    expect(screen.getByRole("button", { name: /Prompts/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("lets an initial pill selection beat the remembered one", async () => {
    // A deep link names the slice it means; the remembered selection only
    // decides where an unqualified visit lands.
    window.sessionStorage.setItem(
      "pj.table.deep-link",
      JSON.stringify({ search: "", pills: { kind: ["rule"] }, sort: null }),
    );

    setup({ pills: PILLS, stateKey: "deep-link", initialPills: { kind: ["prompt"] } });

    await waitFor(() => expect(rowNames()).toEqual(["Bravo"]));
    expect(screen.getByRole("button", { name: /Rules/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("re-applies when a new initial selection arrives", async () => {
    const { rerender } = setup({ pills: PILLS, initialPills: { kind: ["prompt"] } });
    await waitFor(() => expect(rowNames()).toEqual(["Bravo"]));

    rerender(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        rowId={(r) => r.id}
        empty={{ title: "No artifacts yet" }}
        stateKey="test"
        ariaLabel="Artifacts"
        pills={PILLS}
        initialPills={{ kind: ["rule"] }}
      />,
    );

    await waitFor(() => expect(rowNames()).toEqual(["Alpha", "Charlie"]));
  });

  it("leaves the remembered selection alone when no initial one is given", () => {
    window.sessionStorage.setItem(
      "pj.table.no-initial",
      JSON.stringify({ search: "", pills: { kind: ["rule"] }, sort: null }),
    );

    setup({ pills: PILLS, stateKey: "no-initial" });

    expect(rowNames()).toEqual(["Alpha", "Charlie"]);
  });
});
