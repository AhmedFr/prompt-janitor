import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type SyntheticEvent,
} from "react";
import { flexRender, type Header, type Row as TanstackRow } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { DataTableProps } from "./DataTable.types";
import { useDataTable } from "./useDataTable";
import { DataTableSearch } from "./DataTableSearch";
import {
  CLEAR_FILTERS_LABEL,
  NO_MATCH_TITLE,
  ROW_HEIGHT,
  SKELETON_ROWS,
  VIRTUAL_OVERSCAN,
  VIRTUAL_THRESHOLD,
} from "./DataTable.constants";
import "./DataTable.css";

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

/** Anything inside a row that owns its own clicks and keystrokes. */
const INTERACTIVE =
  "button, a, input, select, textarea, label, [role='button'], [role='switch'], [tabindex]:not([tabindex='-1'])";

/**
 * Whether an event belongs to the row itself rather than to a control inside
 * it. A row action must never also open the row — and because the row is
 * focusable it matches `INTERACTIVE` too, so it has to be excluded by
 * identity rather than by selector.
 */
function fromRowItself(event: SyntheticEvent<HTMLTableRowElement>): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return true;
  const control = target.closest(INTERACTIVE);
  return control === null || control === event.currentTarget;
}

/** Ascending / descending / unsorted, as a glyph the header button owns. */
const SORT_GLYPH = { ascending: "▲", descending: "▼", none: "↕" } as const;

/**
 * The one table in the app: search, pills, tri-state sort, sticky header,
 * optional virtualisation. Screens supply column defs and pill predicates and
 * nothing else, so every list in Prompt Janitor behaves identically — the
 * filter you set on one screen works the same way on the next.
 *
 * Height is capped by `--dt-max-h` (70vh by default) on the root, so a table
 * scrolls inside the page instead of pushing the page around it.
 */
export function DataTable<Row>(props: DataTableProps<Row>) {
  const {
    rows,
    search,
    pills,
    onRowClick,
    empty,
    density = "regular",
    virtualize = true,
    toolbarRight,
    ariaLabel,
    rowId,
    rowLabel,
    highlightRowId,
    rowClassName,
    loading = false,
    stateKey,
  } = props;

  const {
    table,
    state,
    setSearch,
    toggleSort,
    togglePill,
    clearFilters,
    counts,
    filteredCount,
    total,
    isFiltered,
  } = useDataTable(props);

  const scrollRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const modelRows = loading ? [] : table.getRowModel().rows;
  const isVirtual = virtualize && modelRows.length > VIRTUAL_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: isVirtual ? modelRows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT[density],
    overscan: VIRTUAL_OVERSCAN,
  });

  // Row heights are pinned per density in CSS; when that changes, every cached
  // measurement describes the old rhythm and the scroll offsets drift.
  useEffect(() => {
    virtualizer.measure();
  }, [density, virtualizer]);

  // Landing on a row is only useful if the row is on screen. Guarded because
  // jsdom (and any non-browser renderer) has no `scrollIntoView` at all.
  useEffect(() => {
    if (!highlightRowId) return;
    // Matched by dataset rather than by selector: a row id is a file path or
    // a plugin name, not something that has to survive CSS escaping.
    const rows = scrollRef.current?.querySelectorAll<HTMLElement>("tr[data-row-id]") ?? [];
    const row = [...rows].find((el) => el.dataset.rowId === highlightRowId);
    if (row && typeof row.scrollIntoView === "function") row.scrollIntoView({ block: "center" });
    // Keyed on the id alone: re-scrolling every time the rows change would
    // fight the user for the scrollbar.
  }, [highlightRowId]);

  const items = virtualizer.getVirtualItems();
  const padTop = isVirtual && items.length > 0 ? items[0].start : 0;
  const padBottom =
    isVirtual && items.length > 0 ? virtualizer.getTotalSize() - items[items.length - 1].end : 0;
  const visibleRows = isVirtual ? items.map((item) => modelRows[item.index]) : modelRows;
  const columnCount = table.getAllLeafColumns().length;

  // With nothing scanned yet there is nothing to search or slice, so the
  // filter controls would only be furniture. `toolbarRight` stays — the way
  // out of an empty table is usually the CTA sitting in it.
  const showFilters = total > 0;

  const sortOf = (header: Header<Row, unknown>) =>
    state.sort?.id === header.column.id ? (state.sort.desc ? "descending" : "ascending") : "none";

  const labelOf = (row: TanstackRow<Row>) => {
    if (rowLabel) return rowLabel(row.original);
    const value = row.getVisibleCells()[0]?.getValue();
    return value == null || value === "" ? rowId(row.original) : String(value);
  };

  const onRowMouseClick = (row: TanstackRow<Row>) => (event: MouseEvent<HTMLTableRowElement>) => {
    if (!fromRowItself(event)) return;
    onRowClick?.(row.original);
  };

  const onRowKeyDown = (row: TanstackRow<Row>) => (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (!fromRowItself(event)) return;
    event.preventDefault();
    onRowClick?.(row.original);
  };

  return (
    <div
      className={cx("dt", density === "compact" && "dt--compact")}
      // `DataTable.css` declares the same heights per density, but the
      // virtualiser estimates scroll offsets from ROW_HEIGHT — so the number
      // rows actually render at comes from there, and the two cannot drift.
      style={{ "--dt-row-h": `${ROW_HEIGHT[density]}px` } as CSSProperties}
    >
      {(showFilters || toolbarRight) && (
        <div className="dt__toolbar">
          {showFilters && search && (
            <DataTableSearch
              placeholder={search.placeholder}
              value={state.search}
              onCommit={setSearch}
              resetKey={stateKey}
            />
          )}

          {showFilters &&
            pills?.map((group) => (
              <div
                className="dt__pills"
                role="group"
                aria-labelledby={`${uid}-pills-${group.id}`}
                key={group.id}
              >
                {/* The group's name is spelled once, visibly: a "Rules 2" chip
                    two chips away from "Global 4" is only readable when the
                    boundary between the two groups is on screen. */}
                <span className="dt__pill-group-label" id={`${uid}-pills-${group.id}`}>
                  {group.label}
                </span>
                {group.options.map((option) => {
                  const on = (state.pills[group.id] ?? []).includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={cx("dt__pill", on && "dt__pill--on")}
                      aria-pressed={on}
                      onClick={() => togglePill(group.id, option.id, !!group.multi)}
                    >
                      {option.label}
                      <span className="dt__pill-count">
                        {option.count ?? counts[group.id]?.[option.id] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}

          {toolbarRight && <div className="dt__toolbar-right">{toolbarRight}</div>}
        </div>
      )}

      <div className="dt__scroll" ref={scrollRef}>
        <table
          className="dt__table"
          aria-label={ariaLabel}
          aria-busy={loading || undefined}
          // Only meaningful while rows are missing from the DOM; a full table
          // already tells assistive tech how many rows there are.
          aria-rowcount={isVirtual ? modelRows.length + 1 : undefined}
        >
          <thead className="dt__head">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} aria-rowindex={isVirtual ? 1 : undefined}>
                {group.headers.map((header) => {
                  const sortable = header.column.getCanSort();
                  const sort = sortOf(header);
                  const right = header.column.columnDef.meta?.align === "right";
                  const label = flexRender(header.column.columnDef.header, header.getContext());
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className={cx("dt__th", right && "dt__cell--right")}
                      aria-sort={sortable ? sort : undefined}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          className="dt__sort"
                          onClick={() => toggleSort(header.column.id)}
                        >
                          {label}
                          <span className="dt__sort-glyph" aria-hidden="true" data-sort={sort}>
                            {SORT_GLYPH[sort]}
                          </span>
                        </button>
                      ) : (
                        label
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {loading &&
              Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <tr key={`skeleton-${index}`} className="dt__skeleton-row" aria-hidden="true">
                  {table.getAllLeafColumns().map((column) => (
                    <td key={column.id} className="dt__cell">
                      <span className="dt__skeleton" />
                    </td>
                  ))}
                </tr>
              ))}

            {padTop > 0 && (
              <tr aria-hidden="true" className="dt__spacer">
                <td colSpan={columnCount} style={{ height: padTop }} />
              </tr>
            )}

            {visibleRows.map((row, index) => (
              <tr
                key={row.id}
                data-row-id={row.id}
                data-index={isVirtual ? items[index].index : undefined}
                // Measured rather than trusted: a wrapped cell is taller than
                // the estimate, and unmeasured rows drift the scrollbar.
                ref={isVirtual ? virtualizer.measureElement : undefined}
                aria-rowindex={isVirtual ? items[index].index + 2 : undefined}
                className={cx(
                  "dt__row",
                  onRowClick && "dt__row--clickable",
                  highlightRowId === row.id && "dt__row--highlight",
                  rowClassName?.(row.original),
                )}
                {...(onRowClick
                  ? {
                      tabIndex: 0,
                      "aria-label": labelOf(row),
                      onClick: onRowMouseClick(row),
                      onKeyDown: onRowKeyDown(row),
                    }
                  : {})}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cx(
                      "dt__cell",
                      cell.column.columnDef.meta?.align === "right" && "dt__cell--right",
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}

            {padBottom > 0 && (
              <tr aria-hidden="true" className="dt__spacer">
                <td colSpan={columnCount} style={{ height: padBottom }} />
              </tr>
            )}

            {!loading && modelRows.length === 0 && (
              <tr className="dt__empty-row">
                <td colSpan={columnCount}>
                  {total === 0 ? (
                    <div className="dt__empty">
                      <p className="dt__empty-title">{empty.title}</p>
                      {empty.hint && <p className="dt__empty-hint">{empty.hint}</p>}
                    </div>
                  ) : (
                    <div className="dt__empty">
                      <p className="dt__empty-title">{NO_MATCH_TITLE}</p>
                      <button type="button" className="dt__clear" onClick={clearFilters}>
                        {CLEAR_FILTERS_LABEL}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Nothing to count while the rows are still on their way. */}
      {!loading && isFiltered && rows.length > 0 && (
        <p className="dt__footer">
          {filteredCount} of {total} rows
        </p>
      )}
    </div>
  );
}
