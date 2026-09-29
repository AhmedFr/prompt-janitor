import type { DimensionScore, FileDetail } from "@/lib/ipc";

/** The two lowest-scoring dimensions joined with " & "; ties keep the fixed order. */
export function weakestTwo(dims: DimensionScore[]): string {
  return [...dims]
    .map((d, i) => ({ ...d, i }))
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .slice(0, 2)
    .map((d) => d.dimension)
    .join(" & ");
}

/**
 * A stable key per finding: its file, source, title and line, never its place
 * in the list. After a fix the list shifts, and a key by position would hand
 * the removed finding's open panel (and its state) to the one below it. Exact
 * duplicates get a `#n` suffix so every key stays unique.
 */
export function findingKeys(fileId: string, issues: FileDetail["issues"]): string[] {
  const seen = new Map<string, number>();
  return issues.map((issue) => {
    const base = `${fileId}:${issue.source}:${issue.title}:${issue.line ?? ""}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}#${n}`;
  });
}
