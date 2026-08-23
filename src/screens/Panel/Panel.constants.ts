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

/** Panel window width in logical pixels — the card plus its inset. */
export const PANEL_WIDTH = 360;

/**
 * The card's margin, top and bottom together. The window is sized to the card
 * plus this: the transparent gap is what makes the rounded corners read as a
 * popover rather than as a rectangle with clipped edges.
 */
export const PANEL_CARD_INSET = 8;

/** Shortest the popover gets. Below this a near-empty card reads as a glitch. */
export const PANEL_MIN_HEIGHT = 240;

/**
 * Tallest the popover gets; past it the card scrolls instead. A popover taller
 * than this hangs off the bottom of a laptop display.
 */
export const PANEL_MAX_HEIGHT = 600;
