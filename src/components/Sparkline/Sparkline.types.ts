export interface SparklineProps {
  /** Series of values, oldest → newest. */
  data: number[];
  width?: number;
  height?: number;
  /** Stroke/fill color (any CSS color, incl. `var(--…)`). */
  color?: string;
}
