import type { ArtifactKind, InvocationKind, Layer } from "@/lib/ipc";
import type { TabItem } from "@/components/Tabs";

/** `sessionStorage` suffix the tab strip remembers itself under (`pj.tabs.project`). */
export const TAB_STATE_KEY = "project";

/**
 * The two tables' `pj.table.*` keys. Deliberately *not* per project: a search
 * or sort is a way of reading a project page, not a fact about one project,
 * and keying per path would leave a hundred stale entries behind — one per
 * project ever opened — for a preference the reader set once.
 */
export const RULES_TABLE_KEY = "project.rules";
export const SETUP_TABLE_KEY = "project.setup";

/** The tabs, in the order the page answers questions about a project. */
export const PROJECT_TABS: TabItem[] = [
  { id: "rules", label: "Rules" },
  { id: "effective", label: "Effective rules" },
  { id: "setup", label: "Setup" },
  { id: "usage", label: "Usage" },
];

export const TAB_IDS = PROJECT_TABS.map((tab) => tab.id);

/** Accessible name of the tab strip. */
export const TABS_LABEL = "Project sections";

/** How many days of usage the page asks the backend for. */
export const USAGE_WINDOW_DAYS = 90;

/** The invocation kinds the usage selector offers, in `InvocationKind`'s own order. */
export const USAGE_KINDS: readonly InvocationKind[] = ["skill", "agent", "mcp", "builtin"] as const;

/** How many ranked targets the usage list shows. */
export const USAGE_LIMIT = 10;

/**
 * A kind's label in the combined setup table's Kind pill. Singular, unlike
 * the Setup screen's tab labels: a pill names what one row *is*, not what a
 * tab holds.
 */
export const KIND_PILL_LABEL: Record<ArtifactKind, string> = {
  rule: "Rule",
  skill: "Skill",
  agent: "Agent",
  command: "Command",
  hook: "Hook",
  mcp_server: "MCP",
  plugin: "Plugin",
  settings: "Settings",
};

/** Nothing was passed in — the route exists but names no project. */
export const NO_SELECTION_TITLE = "No project selected";
export const NO_SELECTION_BODY =
  "This page opens one project at a time. Pick one from the Projects table and it lands here.";

/** The read finished and produced nothing: a failure, never "this project is empty". */
export const FAILED_TITLE = "Project could not be read";
export const FAILED_BODY =
  "The project query failed. This is usually a scan still holding the database — try again.";
export const FAILED_RETRY = "Try again";

/** The read succeeded and no scanned project matches the path. */
export const NOT_FOUND_TITLE = "Project not found";
export const NOT_FOUND_BODY =
  "No scanned project sits at this path. It may have been renamed, or dropped from the scanned folders since it was last seen.";

/** The one label that goes back to the canonical list. */
export const BACK_LABEL = "Back to Projects";

/** A folder the harness remembers and the disk has lost. */
export const MISSING_FOLDER_TITLE = "Folder missing from disk";
export const MISSING_FOLDER_BODY =
  "The harness still remembers this project, but the folder is gone. Everything below is what the last scan saw.";

/**
 * No harness has worked here, so there is no load order to read and nothing
 * to have been invoked. Said once, in both tabs it applies to — the
 * alternative is two empty states that look like "we found nothing" rather
 * than "there was nothing to ask".
 */
export const NO_HARNESS_NOTE =
  "No agent harness has worked in this project, so there is no load order or usage to report.";

/**
 * A refresh failed over a page that had already loaded. The page keeps what
 * it has — throwing away a good page because the *refresh* failed loses the
 * reader everything — but it has to say that the numbers are the previous
 * scan's, or the failure is invisible and the staleness is a lie.
 */
export const STALE_NOTE =
  "This page could not be refreshed, so it is showing the previous scan. Try rescanning.";

/** Opens the flat Prompts table, filtered to this project. */
export const SEE_ALL_FILES_LABEL = "See all files";

export const RESCAN_LABEL = "Rescan";
export const RESCAN_BUSY_LABEL = "Scanning…";

export const RULES_EMPTY_TITLE = "No prompt files scanned here";
export const RULES_EMPTY_HINT = "Rescan to pick up anything added since the last scan.";
export const RULES_SEARCH_PLACEHOLDER = "Search file name or path";

export const SETUP_EMPTY_TITLE = "Nothing configured in this project";
export const SETUP_EMPTY_HINT = RULES_EMPTY_HINT;
export const SETUP_SEARCH_PLACEHOLDER = "Search name, description or path";

export const EFFECTIVE_TITLE = "Load order";
export const EFFECTIVE_EMPTY = "No rule files load in this project.";

/**
 * The harness-scoped read failed. Deliberately not {@link EFFECTIVE_EMPTY}:
 * "no rule files load here" is a finding about the project, and a failed read
 * is a finding about the database. A reader who acts on the first when the
 * second is true goes and writes a rule file they already have.
 */
export const EFFECTIVE_UNREADABLE =
  "The load order could not be read. This is usually a scan still holding the database — rescan to try again.";

/** Which layer a rule in the load-order stack comes from. */
export const LAYER_LABEL: Record<Layer, string> = {
  global: "Global",
  plugin: "Plugin",
  project: "Project",
};

export const USAGE_TITLE = "Top used here";
export const USAGE_EMPTY = `Nothing was invoked here in the last ${USAGE_WINDOW_DAYS} days.`;
/**
 * When the window held *something*, but nothing of the kind on screen. The
 * blanket "nothing was invoked here" would be a lie in that case, and would
 * send the reader looking for a scan that already ran.
 */
export const USAGE_KIND_EMPTY: Record<InvocationKind, string> = {
  skill: `No skills were invoked here in the last ${USAGE_WINDOW_DAYS} days.`,
  agent: `No agents were invoked here in the last ${USAGE_WINDOW_DAYS} days.`,
  mcp: `No MCP tools were called here in the last ${USAGE_WINDOW_DAYS} days.`,
  builtin: `No built-in tools were used here in the last ${USAGE_WINDOW_DAYS} days.`,
};

/** The usage read failed — see {@link EFFECTIVE_UNREADABLE} for why this is not the empty copy. */
export const USAGE_UNREADABLE =
  "Usage could not be read. This is usually a scan still holding the database — rescan to try again.";

export const SESSIONS_CHART_LABEL = "Sessions per day";
export const SESSIONS_CHART_TITLE = `Sessions per day · last ${USAGE_WINDOW_DAYS} days`;

/** Square size of the header's project logo/folder glyph, in px. */
export const HEADER_GLYPH_SIZE = 34;
/** Diameter of the header's grade ring, in px. */
export const HEADER_RING_SIZE = 78;
