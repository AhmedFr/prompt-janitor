import type { TrendPoint } from "@/lib/ipc";

export interface TrendChartProps {
  data: TrendPoint[];
  height?: number;
}
