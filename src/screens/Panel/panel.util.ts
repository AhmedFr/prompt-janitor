import type { Grade, PanelFix } from "@/lib/ipc";
import { plural, relativeSession } from "@/screens/Setup/setup.util";
import type { SignalTone, Verdict } from "./Panel.types";
import { DELTA_DOWN, DELTA_UNCHANGED, DELTA_UP, NEVER_SCANNED, VERDICTS } from "./Panel.constants";

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
