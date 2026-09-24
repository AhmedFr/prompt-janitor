import { gradeForScore } from "@/lib/scoring";
import type { TrendDomainBound } from "./TrendChart.types";

/** Where a date label is going: the axis has room for a day, the tooltip for a time too. */
export type TrendLabelStyle = "axis" | "tooltip";

const EPOCH_SECONDS = /^\d{9,11}$/;
const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const DAY: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const DAY_AND_TIME: Intl.DateTimeFormatOptions = { ...DAY, hour: "numeric", minute: "2-digit" };

/**
 * Labels an x value the chart was handed. The series in the app key their x
 * two ways — epoch-seconds strings (`grade_history.recorded_at`) and calendar
 * days (`YYYY-MM-DD`, sessions per day) — and both read as "Sep 18" on the
 * axis. The tooltip adds the time for epoch points, since two scans on the
 * same day would otherwise carry identical labels. A calendar day is built in
 * local time from its parts, so it never slides to the previous day west of
 * UTC. Anything else is shown as given.
 */
export function formatTrendX(x: string | number, style: TrendLabelStyle): string {
  const raw = String(x);
  if (EPOCH_SECONDS.test(raw)) {
    const date = new Date(Number(raw) * 1000);
    return date.toLocaleString("en-US", style === "tooltip" ? DAY_AND_TIME : DAY);
  }
  const day = CALENDAR_DAY.exec(raw);
  if (day) {
    const date = new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
    return date.toLocaleDateString("en-US", DAY);
  }
  return raw;
}

/**
 * Explicit y ticks for a fixed numeric domain, in quarters — a 0–100 score
 * reads 0 / 25 / 50 / 75 / 100 rather than whatever Recharts' nice-number
 * pass lands on. An open-ended domain (a count with no ceiling) returns
 * `undefined` and keeps Recharts' own ticks.
 */
export function ticksForDomain([lo, hi]: [TrendDomainBound, TrendDomainBound]): number[] | undefined {
  if (typeof lo !== "number" || typeof hi !== "number") return undefined;
  const step = (hi - lo) / 4;
  return [0, 1, 2, 3, 4].map((i) => lo + step * i);
}

/** Tooltip detail for a 0–100 score: the letter grade it lands in. */
export function scoreGradeDetail(score: number): string {
  return `Grade ${gradeForScore(score)}`;
}
