import type { GradeLetter } from "@/components/Grade";

/** Every grade a project can carry, in report-card order — one filter chip each. */
export const GRADE_LETTERS: readonly GradeLetter[] = ["A", "B", "C", "D", "F"] as const;

/** Square size of the row's project logo/folder glyph, in px. */
export const GLYPH_SIZE = 18;

/** What the Status column says about a project the harness knows and the disk does not. */
export const MISSING_FOLDER_CHIP = "folder missing";

/** `sessionStorage` suffix this table persists its search/pills/sort under (`pj.table.projects`). */
export const TABLE_STATE_KEY = "projects";

/** One box searches the two things a project is identified by. */
export const SEARCH_PLACEHOLDER = "Search project name or path";

/** Nothing scanned yet — the honest headline, and the one lever from here. */
export const EMPTY_TITLE = "No projects scanned yet";
export const EMPTY_HINT = "Add a folder from Setup and Prompt Janitor will grade what it finds inside.";
