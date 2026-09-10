/** Above this many rows a `virtualize` table stops rendering every `<tr>`. */
export const VIRTUAL_THRESHOLD = 200;

/** Estimated row heights the virtualiser scrolls by, per density. */
export const ROW_HEIGHT = { regular: 44, compact: 34 } as const;

/** Rows kept mounted above and below the viewport so scrolling doesn't flash. */
export const VIRTUAL_OVERSCAN = 10;

/** Copy shown when filters exclude everything. */
export const NO_MATCH_TITLE = "No rows match — clear filters";
export const CLEAR_FILTERS_LABEL = "Clear filters";

/**
 * The toolbar's own reset, distinct from the empty state's `CLEAR_FILTERS_LABEL`:
 * "all" is what makes it read as wider than the group whose popover the user
 * just closed, which has a `Clear` of its own.
 */
export const CLEAR_ALL_LABEL = "Clear all";

/** How long typing settles before the table re-filters. */
export const SEARCH_DEBOUNCE_MS = 150;

/** Placeholder rows shown while `loading` — enough to read as a table, not a page. */
export const SKELETON_ROWS = 5;

/**
 * The floor, in CSS pixels, under a column that declares no `meta.width` in a
 * fixed-layout table (see `ColumnMeta.width`).
 *
 * Fixed layout hands the undeclared columns whatever the sized ones leave —
 * which is nothing once the window is narrow enough, and a Name column
 * rendered at 0px is worse than one that scrolls. Summed with the declared
 * widths into a `min-width` on the table, so past that point the table stops
 * shrinking and `.dt__scroll` takes over.
 */
export const FLEX_COLUMN_MIN = 180;
