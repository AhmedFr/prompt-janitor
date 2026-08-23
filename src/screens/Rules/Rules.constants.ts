import type { RuleTabId } from "./Rules.types";

/** The three tabs, in display order: what shipped, what you wrote, what the model judges. */
export const RULE_TABS: { id: RuleTabId; label: string }[] = [
  { id: "builtin", label: "Built-in" },
  { id: "custom", label: "Custom" },
  { id: "ai", label: "AI standards" },
];

/** Tab id -> the label the strip shows, so a table's accessible name reads the way its tab does. */
export const TAB_LABELS: Record<RuleTabId, string> = RULE_TABS.reduce(
  (acc, tab) => ({ ...acc, [tab.id]: tab.label }),
  {} as Record<RuleTabId, string>,
);

/** Every tab id, for `useTabState` to resolve a remembered (or passed-in) one against. */
export const TAB_IDS: RuleTabId[] = RULE_TABS.map((tab) => tab.id);

/** `sessionStorage` suffix the tab strip remembers itself under (`pj.tabs.rules`). */
export const TAB_STATE_KEY = "rules";

/** `sessionStorage` prefix each tab's table persists search/pills/sort under (`pj.table.rules.<tab>`). */
export const TABLE_STATE_PREFIX = "rules.";

/**
 * Where `/rules/new` leaves the id of the rule it just saved, so this screen
 * can land on that row. Read once on mount and removed immediately: a
 * highlight is about the trip you just made, not every later visit.
 */
export const HIGHLIGHT_KEY = "pj.rules.highlight";

/** One box searches the three things a rule is recognised by — including the pattern no column spells out. */
export const SEARCH_PLACEHOLDER = "Search rule name, description or pattern";

/** Per-tab empty headline. Only Custom and AI can honestly be empty; Built-in ships full. */
export const EMPTY_TITLE: Record<RuleTabId, string> = {
  builtin: "No built-in rules loaded",
  custom: "No rules of your own yet",
  ai: "No AI standards yet",
};

export const EMPTY_HINT: Record<RuleTabId, string> = {
  builtin: "The rule packs failed to load — rescan, or reinstall the app.",
  custom: "Add a rule and Prompt Janitor will flag every file that breaks it.",
  ai: "Add a natural-language standard and your AI provider will judge each file against it.",
};

export const ADD_RULE_LABEL = "Add rule";
export const IMPORT_PACK_LABEL = "Import pack…";

/** What the AI tab says once a provider is connected — carried over from the old composer. */
export const AI_NOTE_READY =
  "Evaluated by your AI provider when you check a file on its detail page.";

/**
 * And what it says when there is none. Gated on a configured provider only:
 * monetisation is paused, so a licence never decides what this screen shows.
 */
export const AI_NOTE_NO_PROVIDER =
  "Not evaluated yet — connect an AI provider in Settings → AI and these standards start running on the files you check.";

/**
 * A browser, not the desktop app: the rule set lives in a local database the
 * web build cannot reach. Says so, rather than showing three empty tables
 * whose hints blame a failed load.
 */
export const NO_RUNTIME_BODY = "Open the desktop app to manage rules.";

/**
 * The load finished with nothing to show — not because there are no rules
 * (the app ships with them) but because the read failed. Almost always a scan
 * still holding the database, which is why the only lever offered is a retry.
 */
export const FAILED_TITLE = "Rules could not be read";
export const FAILED_BODY =
  "The rule list query failed. This is usually a scan still holding the database — try again.";
export const FAILED_RETRY = "Try again";

/** How long a status line stays on screen before it stops being news, in ms. */
export const STATUS_MSG_MS = 4000;

/** Clipboard outcomes. Both are said out loud: a copy that silently failed is worse than one that says so. */
export const COPY_OK = "Pattern copied";
export const COPY_FAILED = "Couldn't copy";

/**
 * Mutations are applied optimistically, so a failure has to be both undone
 * *and* announced — a switch that quietly springs back reads as a bug in the
 * switch rather than as a write that did not land.
 */
export const TOGGLE_FAILED = "Could not change that rule — try again.";
export const DELETE_FAILED = "Could not delete that rule — try again.";
export const IMPORT_FAILED = "Could not import that pack — try again.";
