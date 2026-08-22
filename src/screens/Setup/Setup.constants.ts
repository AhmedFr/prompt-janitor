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
 * "High cost" is relative, not absolute: an artifact costs a lot when its
 * average turn burns at least twice what the typical measured artifact burns.
 */
export const COST_MEDIAN_MULTIPLIER = 2;

/** Fewest measured artifacts a median needs before "high cost" means anything. */
export const MIN_COST_SAMPLES = 2;

/** `sessionStorage` suffix the kind tab strip remembers itself under (`pj.tabs.setup`). */
export const TAB_STATE_KEY = "setup";

/** Prefix of each kind table's own `pj.table.setup.<kind>` entry. */
export const TABLE_STATE_PREFIX = "setup.";

/** What an empty tab suggests doing about it — the only lever from this screen. */
export const EMPTY_HINT = "Rescan to pick up anything added since the last scan.";

/**
 * What an empty tab says. Spelled per kind rather than derived from the tab
 * label: "No mcp found" is what lower-casing "MCP" gets you, and a screen
 * that only ever shows this line when there is nothing at all to show is the
 * wrong place to be clever.
 */
export const EMPTY_TITLE: Record<ArtifactKind, string> = {
  rule: "No rule files found",
  skill: "No skills installed",
  agent: "No agents installed",
  command: "No commands installed",
  hook: "No hooks configured",
  mcp_server: "No MCP servers configured",
  plugin: "No plugins installed",
  settings: "No settings files found",
};

/** One box searches every column that holds words, so it says so once. */
export const SEARCH_PLACEHOLDER = "Search name, description or scope";
