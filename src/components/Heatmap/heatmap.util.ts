import type { FileRow, Grade } from "@/lib/ipc";
import type { HeatLegend, HeatSquare } from "./Heatmap.types";

const GRADES: Grade[] = ["A", "B", "C", "D", "F"];

export function bucketFiles(files: FileRow[]): {
  squares: HeatSquare[];
  legend: HeatLegend[];
} {
  const squares = files
    .map((f) => ({
      id: f.id,
      name: f.name,
      grade: f.grade,
      score: f.score,
    }))
    .sort((a, b) => b.score - a.score);

  const counts = new Map<Grade, number>(GRADES.map((g) => [g, 0]));
  for (const s of squares) counts.set(s.grade, (counts.get(s.grade) ?? 0) + 1);

  const legend = GRADES.map((grade) => ({
    grade,
    count: counts.get(grade) ?? 0,
  }));

  return { squares, legend };
}
