import type { DimensionScore } from "@/lib/ipc";

/** The two lowest-scoring dimensions joined with " & "; ties keep the fixed order. */
export function weakestTwo(dims: DimensionScore[]): string {
  return [...dims]
    .map((d, i) => ({ ...d, i }))
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .slice(0, 2)
    .map((d) => d.dimension)
    .join(" & ");
}
