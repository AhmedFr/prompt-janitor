import { END_DOT_RADIUS, RING_WIDTH } from "./TrendChart.constants";
import type { TrendEndDotProps } from "./TrendChart.types";

/**
 * Marks only the latest point — the one the reader is asked about ("where are
 * we now?") — with a filled dot ringed in the card surface, so it stays legible
 * where it sits on the line. Every earlier point is left to the line and the
 * hover crosshair; a dot on each of 90 points is noise.
 */
export function TrendEndDot({ index, lastIndex, cx, cy }: TrendEndDotProps) {
  if (index !== lastIndex || cx === undefined || cy === undefined) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={END_DOT_RADIUS}
      fill="var(--blue)"
      stroke="var(--card)"
      strokeWidth={RING_WIDTH}
    />
  );
}
