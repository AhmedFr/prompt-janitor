import type { UsageStat } from "@/lib/ipc";
import { ERROR_RATE_THRESHOLD, STALE_DAYS } from "./UsageBadge.constants";

export type UsageTone = "used" | "never" | "error" | "stale";

function relative(from: Date, now: Date): string {
  const ms = now.getTime() - from.getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

/**
 * Turns a raw usage rollup into a display label + a tone the badge colors by.
 *
 * The label carries the *reason* for the tone, not just the counts: a red chip
 * that only reads "used 40× · 12 sessions" leaves the whole signal in the
 * colour, which is invisible to anyone who cannot see it and ambiguous to
 * everyone else. So an error-toned badge names its error rate, and a stale one
 * says "stale" out loud next to the date that made it stale.
 */
export function formatUsage(usage: UsageStat | null, now: Date): { label: string; tone: UsageTone } {
  if (!usage || usage.total === 0) return { label: "never used", tone: "never" };
  const sessions = `${usage.sessions} ${usage.sessions === 1 ? "session" : "sessions"}`;
  const last = usage.last_used ? new Date(usage.last_used) : null;
  const head = `used ${usage.total}× · ${sessions}`;

  // specta exports Rust's f64 as `number | null`; treat a missing rate as 0.
  const errorRate = usage.error_rate ?? 0;
  if (errorRate >= ERROR_RATE_THRESHOLD) {
    return { label: `${head} · ${Math.round(errorRate * 100)}% errored`, tone: "error" };
  }
  if (last && now.getTime() - last.getTime() > STALE_DAYS * 86_400_000) {
    return { label: `${head} · stale, last ${relative(last, now)}`, tone: "stale" };
  }
  return { label: last ? `${head} · last ${relative(last, now)}` : head, tone: "used" };
}
