import type { Verdict } from "./Panel.types";

/** The verdict lines, named so the util reads as a decision rather than as copy. */
export const VERDICTS: Record<"good" | "warn" | "bad", Verdict> = {
  good: "Good enough",
  warn: "Needs work",
  bad: "Fix now",
};

export const DELTA_UP = "▲";
export const DELTA_DOWN = "▼";
export const DELTA_UNCHANGED = "No change";

export const NO_SCAN_TITLE = "No scan yet";
export const NO_SCAN_HINT = "Scan once and this panel answers in ten seconds.";

export const FAILED_TITLE = "Panel could not be read";
export const FAILED_BODY =
  "The snapshot query failed. This is usually a scan still holding the database — try again in a moment.";
export const FAILED_RETRY = "Try again";

export const LOADING_LABEL = "Loading the panel";

/**
 * Whose sessions a scan is indexing, for the phase line. The snapshot carries
 * no harness list — naming one the panel cannot see would be a guess.
 */
export const SCAN_HARNESS = "agent";

/** No scan has ever finished — "Scanned never" reads like a bug. */
export const NEVER_SCANNED = "Never scanned";
