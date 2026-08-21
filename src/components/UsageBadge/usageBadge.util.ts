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

/** Turns a raw usage rollup into a display label + a tone the badge colors by. */
export function formatUsage(usage: UsageStat | null, now: Date): { label: string; tone: UsageTone } {
  if (!usage || usage.total === 0) return { label: "never used", tone: "never" };
  const sessions = `${usage.sessions} ${usage.sessions === 1 ? "session" : "sessions"}`;
  const last = usage.last_used ? new Date(usage.last_used) : null;
  const lastLabel = last ? ` · last ${relative(last, now)}` : "";
  const label = `used ${usage.total}× · ${sessions}${lastLabel}`;
  let tone: UsageTone = "used";
  // specta exports Rust's f64 as `number | null`; treat a missing rate as 0.
  if ((usage.error_rate ?? 0) >= ERROR_RATE_THRESHOLD) tone = "error";
  else if (last && now.getTime() - last.getTime() > STALE_DAYS * 86_400_000) tone = "stale";
  return { label, tone };
}
