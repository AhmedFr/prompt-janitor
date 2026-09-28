import type { ArtifactKind } from "@/lib/ipc";

/**
 * The order artifact kinds are presented in — configuration first (rules), then
 * the things an agent invokes, then the plumbing. Matches the `ArtifactKind`
 * union's declaration order in the generated bindings.
 */
export const KIND_ORDER: readonly ArtifactKind[] = [
  "rule",
  "skill",
  "agent",
  "command",
  "hook",
  "mcp_server",
  "plugin",
  "settings",
] as const;

/** An artifact whose invocations fail this often is worth a second look. */
export const ERROR_RATE_THRESHOLD = 0.25;

/**
 * Where the Error % column turns amber: failing one call in ten is not yet a
 * finding (the "Errors" filter still starts at {@link ERROR_RATE_THRESHOLD}),
 * but it is the band a rate passes through on its way there.
 */
export const ERROR_RATE_WATCH = 0.1;

/** The Error % column's green / amber / red lines. Red is exactly what the "Errors" filter keeps. */
export const ERROR_RATE_BANDS = { watch: ERROR_RATE_WATCH, bad: ERROR_RATE_THRESHOLD } as const;

/**
 * "High cost" is relative, not absolute: an artifact costs a lot when its
 * average turn burns at least twice what the typical measured artifact burns.
 */
export const COST_MEDIAN_MULTIPLIER = 2;

/** Fewest measured artifacts a median needs before "high cost" means anything. */
export const MIN_COST_SAMPLES = 2;

/** `sessionStorage` suffix Setup's one table remembers its search, pills and sort under (`pj.table.setup.unified`). */
export const TABLE_STATE_KEY = "setup.unified";

/** What an empty slice suggests doing about it — the only lever from this screen. */
export const EMPTY_HINT = "Rescan to pick up anything added since the last scan.";

/** What the table says when the chips, filters or search leave nothing (spec §4.5). */
export const EMPTY_FILTERED = "No items match";

/** What the table says when the scan found a harness but no items at all. */
export const NO_ITEMS_TITLE = "No items in this setup yet";

/** The Instructions chip's one action: write a starter instruction file from a template. */
export const NEW_FROM_TEMPLATE = "New from template…";

/** What Setup says when the scan found no harness at all (spec §4.5). */
export const NO_HARNESS_TITLE = "No Claude Code setup found";

/** One box searches every column that holds words, so it says so once. */
export const SEARCH_PLACEHOLDER = "Search name, description, path or scope";
