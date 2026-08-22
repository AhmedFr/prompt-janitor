/** Above this many rows a `virtualize` table stops rendering every `<tr>`. */
export const VIRTUAL_THRESHOLD = 200;

/** Estimated row heights the virtualiser scrolls by, per density. */
export const ROW_HEIGHT = { regular: 44, compact: 34 } as const;

/** Rows kept mounted above and below the viewport so scrolling doesn't flash. */
export const VIRTUAL_OVERSCAN = 10;

/** Copy shown when filters exclude everything. */
export const NO_MATCH_TITLE = "No rows match — clear filters";
export const CLEAR_FILTERS_LABEL = "Clear filters";

/** How long typing settles before the table re-filters. */
export const SEARCH_DEBOUNCE_MS = 150;

/** Placeholder rows shown while `loading` — enough to read as a table, not a page. */
export const SKELETON_ROWS = 5;
