import type { FileRow, Grade } from "@/lib/ipc";

export interface HeatSquare {
  id: string;
  name: string;
  grade: Grade;
  score: number;
}

export interface HeatLegend {
  grade: Grade;
  count: number;
}

export interface HeatmapProps {
  files: FileRow[];
  onSelect?: (id: string) => void;
}
