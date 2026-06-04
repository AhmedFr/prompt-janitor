/** Format a Unix-epoch-seconds string as a short relative time (e.g. "3h", "2d"). */
export function relativeTime(epoch?: string | null): string {
  if (!epoch) return "—";
  const secs = Number(epoch);
  if (!Number.isFinite(secs) || secs <= 0) return "—";
  const diff = Date.now() / 1000 - secs;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
