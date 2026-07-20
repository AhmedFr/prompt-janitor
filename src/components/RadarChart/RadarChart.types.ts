import type { DimensionScore, Grade } from "@/lib/ipc";

export interface RadarChartProps {
  data: DimensionScore[];
  grade: Grade;
  size?: number;
}
