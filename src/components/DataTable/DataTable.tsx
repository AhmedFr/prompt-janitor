import { useRef, type KeyboardEvent } from "react";
import { flexRender, type Header, type Row as TanstackRow } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Icon } from "@/components/Icon";
import type { DataTableProps } from "./DataTable.types";
import { useDataTable } from "./useDataTable";
import {
  CLEAR_FILTERS_LABEL,
  NO_MATCH_TITLE,
  ROW_HEIGHT,
  VIRTUAL_OVERSCAN,
  VIRTUAL_THRESHOLD,
} from "./DataTable.constants";
import "./DataTable.css";

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

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
    virtualize,
    toolbarRight,
    ariaLabel,
    rowId,
  } = props;

  const {
    table,
    state,
    query,
    setQuery,
    toggleSort,
    togglePill,
    clearFilters,
    counts,
    filteredCount,
    total,
    isFiltered,
  } = useDataTable(props);

  const scrollRef = useRef<HTMLDivElement>(null);
  const modelRows = table.getRowModel().rows;
  const isVirtual = !!virtualize && modelRows.length > VIRTUAL_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: isVirtual ? modelRows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT[density],
    overscan: VIRTUAL_OVERSCAN,
  });

  const items = virtualizer.getVirtualItems();
  const padTop = isVirtual && items.length > 0 ? items[0].start : 0;
  const padBottom =
    isVirtual && items.length > 0 ? virtualizer.getTotalSize() - items[items.length - 1].end : 0;
  const visibleRows = isVirtual ? items.map((item) => modelRows[item.index]) : modelRows;
  const leafColumns = table.getAllLeafColumns();
  const columnCount = leafColumns.length;

  // A row is a button only when nothing inside it is: nesting an actions
  // column inside `role="button"` is an `aria` violation, and the row actions
  // are the thing that stops being reachable. Such rows stay focusable and
  // keyboard-operable, they just keep their native `row` role.
  const rowIsButton = !!onRowClick && !leafColumns.some((c) => c.columnDef.meta?.interactive);

  // With nothing scanned yet there is nothing to search or slice, so the
  // filter controls would only be furniture. `toolbarRight` stays — the way
  // out of an empty table is usually the CTA sitting in it.
  const showFilters = total > 0;

  const sortOf = (header: Header<Row, unknown>) =>
    state.sort?.id === header.column.id ? (state.sort.desc ? "descending" : "ascending") : "none";

  const labelOf = (row: TanstackRow<Row>) => {
    const first = row.getVisibleCells()[0];
    const value = first?.getValue();
    return value == null || value === "" ? rowId(row.original) : String(value);
  };

  const onRowKeyDown = (row: TanstackRow<Row>) => (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onRowClick?.(row.original);
  };

  return (
    <div className={cx("dt", density === "compact" && "dt--compact")}>
      {(showFilters || toolbarRight) && (
        <div className="dt__toolbar">
          {showFilters && search && (
            <div className="dt__search">
              <Icon name="search" size={14} />
              <input
                type="search"
                className="dt__search-input"
                value={query}
                placeholder={search.placeholder}
                aria-label={search.placeholder}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          )}

          {showFilters &&
            pills?.map((group) => (
              <div className="dt__pills" role="group" aria-label={group.label} key={group.id}>
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
        <table className="dt__table" aria-label={ariaLabel}>
          <thead className="dt__head">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
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
            {padTop > 0 && (
              <tr aria-hidden="true" className="dt__spacer">
                <td colSpan={columnCount} style={{ height: padTop }} />
              </tr>
            )}

            {visibleRows.map((row) => (
              <tr
                key={row.id}
                data-row-id={row.id}
                className={cx("dt__row", onRowClick && "dt__row--clickable")}
                {...(onRowClick
                  ? {
                      ...(rowIsButton ? { role: "button" as const } : {}),
                      tabIndex: 0,
                      "aria-label": labelOf(row),
                      onClick: () => onRowClick(row.original),
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

            {modelRows.length === 0 && (
              <tr className="dt__row">
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

      {isFiltered && rows.length > 0 && (
        <p className="dt__footer">
          {filteredCount} of {total} rows
        </p>
      )}
    </div>
  );
}
