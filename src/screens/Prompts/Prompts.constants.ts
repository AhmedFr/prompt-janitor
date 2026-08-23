/** `sessionStorage` suffix this table persists its search/pills/sort under (`pj.table.prompts`). */
export const TABLE_STATE_KEY = "prompts";

/** Accessible name of the table itself. */
export const TABLE_LABEL = "Prompt files";

/** Square size of the row's provider brand mark, in px. */
export const GLYPH_SIZE = 18;

/**
 * The path is the one thing every file has that tells it apart: a project can
 * hold several `CLAUDE.md`, and searching the name alone would find all of
 * them. The name is a suffix of the path, so this box finds it too.
 */
export const SEARCH_PLACEHOLDER = "Search file path";

/** Nothing scanned yet — the honest headline, and the two levers from here. */
export const EMPTY_TITLE = "No prompt files scanned yet";
export const EMPTY_HINT =
  "Add a folder from Setup, or start from a ready-made instruction file above.";

/**
 * The load finished with nothing to show — not because nothing is scanned,
 * but because the read failed. Almost always a scan still holding the
 * database, which is why the only lever offered is "try it again".
 */
export const FAILED_TITLE = "Prompts could not be read";
export const FAILED_BODY =
  "The file list query failed. This is usually a scan still holding the database — try again.";
export const FAILED_RETRY = "Try again";

export const SCAN_LABEL = "Scan now";
export const TEMPLATE_LABEL = "Start from a template";

/**
 * How many projects get a chip of their own. A real install has hundreds of
 * files across dozens of projects; a chip per project would be a wall of them,
 * so the busiest twelve are named and the tail shares one bucket.
 */
export const PROJECT_PILL_LIMIT = 12;

/**
 * The tail bucket's option id. Prefixed so it can never collide with a real
 * project id — those are absolute paths.
 */
export const OTHER_PROJECT_ID = "__other";
export const OTHER_PROJECT_LABEL = "Other";
