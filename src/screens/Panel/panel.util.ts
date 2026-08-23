import type { Grade, PanelFix } from "@/lib/ipc";
import { plural, relativeSession } from "@/screens/Setup/setup.util";
import type { SignalTone, Verdict } from "./Panel.types";
import {
  DELTA_DOWN,
  DELTA_UNCHANGED,
  DELTA_UP,
  NEVER_SCANNED,
  PANEL_CARD_INSET,
  PANEL_MAX_HEIGHT,
  PANEL_MIN_HEIGHT,
  VERDICTS,
} from "./Panel.constants";

/**
 * The panel's whole reason to exist in three words: is this setup good enough
 * right now? Graded rather than scored — a number needs a scale to read, and
 * the panel is looked at for ten seconds.
 */
export function verdictFor(grade: Grade): Verdict {
  if (grade === "A" || grade === "B") return VERDICTS.good;
  if (grade === "C") return VERDICTS.warn;
  // D and F are the same call to action: the setup is actively costing the user.
  return VERDICTS.bad;
}

/**
 * Which way the score moved since the previous scan. The arrow carries the
 * sign, so the number is printed unsigned — "▼ -2" reads as a double negative.
 */
export function deltaCopy(delta: number): string {
  if (delta > 0) return `${DELTA_UP} ${delta} since last scan`;
  if (delta < 0) return `${DELTA_DOWN} ${Math.abs(delta)} since last scan`;
  return DELTA_UNCHANGED;
}

/** A signal chip is a problem the moment its count leaves zero. */
export function signalTone(count: number): SignalTone {
  return count > 0 ? "error" : "ok";
}

/**
 * The accessible name of a fix row. The row spreads the file, its project, its
 * grade and its issue count across four columns; the label replaces all of
 * them for a screen reader, so it has to carry all four — "Open CLAUDE.md" says
 * nothing about why this row is worth opening first.
 */
export function fixLabel(fix: PanelFix): string {
  return `Open ${fix.name} in ${fix.project_name} — grade ${fix.grade}, ${plural(fix.issue_count, "issue")}`;
}

/**
 * When the numbers above were measured. Its own line rather than a suffix on
 * the verdict: an hours-old answer is still worth reading, a month-old one is
 * not, and the reader has to be able to tell which they are looking at.
 */
export function lastScanLine(iso: string | null, now?: Date): string {
  if (!iso) return NEVER_SCANNED;
  return `Scanned ${relativeSession(iso, now)}`;
}

/**
 * The header's one muted line: the score, then when it was measured.
 *
 * The number used to live inside the ring, but the panel draws that ring at
 * 56 px, where a second line of type does not fit. It belongs on the header's
 * meta line rather than nowhere: a grade letter without its score cannot tell
 * a bare pass from a near miss.
 */
export function metaLine(score: number, iso: string | null, now?: Date): string {
  return `${score}/100 · ${lastScanLine(iso, now)}`;
}

/**
 * The window height for a card that measured `contentHeight` — the popover
 * hugs its content instead of always being 480 px of card with a dead gap
 * under it.
 *
 * Rounded, because a fractional layout height would ask the window to resize
 * on every repaint, and clamped at both ends: a near-empty card floating under
 * the menu bar reads as a glitch, and a very tall one runs off the display.
 */
export function panelHeight(contentHeight: number): number {
  const height = Math.round(contentHeight) + PANEL_CARD_INSET;
  return Math.min(Math.max(height, PANEL_MIN_HEIGHT), PANEL_MAX_HEIGHT);
}
