import { useId } from "react";
import type { SparklineProps } from "./Sparkline.types";
import "./Sparkline.css";

/**
 * Compact trend line with a soft gradient fill, sized to whatever width its
 * container gives it. The svg stretches (`preserveAspectRatio="none"`) so the
 * line always spans the card, which is why nothing round lives inside it:
 * the stroke opts out of the stretch with `vector-effect`, and the end marker
 * is an HTML dot positioned by percentage over the svg — an svg `<circle>`
 * there would render as an ellipse at every width but the viewBox's own.
 */
export function Sparkline({ data, width = 220, height = 46, color = "var(--blue)" }: SparklineProps) {
  const gradientId = useId();
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pad = 3;

  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / (max - min || 1)) * (height - pad * 2);
    return [x, y] as const;
  });

  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const first = pts[0];
  const last = pts[pts.length - 1];
  const area = `${line} L${last[0].toFixed(1)} ${height} L${first[0].toFixed(1)} ${height} Z`;

  return (
    <div className="sparkline" style={{ height }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.22" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="sparkline__dot"
        style={{ left: `${(last[0] / width) * 100}%`, top: `${(last[1] / height) * 100}%`, background: color }}
        aria-hidden="true"
      />
    </div>
  );
}
