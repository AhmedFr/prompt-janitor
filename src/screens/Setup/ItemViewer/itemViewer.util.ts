/** The row `delta` away from `current` in on-screen order, clamped; `null` if `current` left the screen. */
export function stepTarget(ids: string[], current: string, delta: -1 | 1): string | null {
  const at = ids.indexOf(current);
  if (at < 0) return null;
  return ids[Math.min(ids.length - 1, Math.max(0, at + delta))];
}
