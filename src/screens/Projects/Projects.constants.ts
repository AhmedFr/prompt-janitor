import { LABEL } from "@/lib/vocabulary";

/** Square size of the row's project logo/folder glyph, in px. */
export const GLYPH_SIZE = 18;

/** `sessionStorage` suffix this table persists its search/pills/sort under (`pj.table.projects`). */
export const TABLE_STATE_KEY = "projects";

/** One box searches the two things a project is identified by. */
export const SEARCH_PLACEHOLDER = "Search project name or path";

/** Nothing scanned yet (spec §7) — the honest headline, and the one lever from here. */
export const EMPTY_TITLE = "No projects yet";
export const EMPTY_HINT = `${LABEL.addFolder} in Settings → Folders and Prompt Janitor will read what it finds inside.`;

/**
 * The load finished with nothing to show — not because nothing is scanned,
 * but because the read failed. Almost always a scan still holding the
 * database, which is why the only lever offered is "try it again".
 */
export const FAILED_TITLE = "Projects could not be read";
export const FAILED_BODY =
  "The project list query failed. This is usually a scan still holding the database — try again.";
export const FAILED_RETRY = "Try again";
