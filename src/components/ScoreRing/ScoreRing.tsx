import type { ScoreRingProps } from "./ScoreRing.types";
import { GRADE_COLOR_VAR } from "./ScoreRing.constants";

/** Radial gauge showing a 0–100 score with its grade letter at the center. */
export function ScoreRing({ score, grade, size = 120 }: ScoreRingProps) {
  const radius = size / 2 - 9;
  const circumference = 2 * Math.PI * radius;
  const pct = (score ?? 0) / 100;
  const colorVar = GRADE_COLOR_VAR[grade ?? "C"];

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#ececef" strokeWidth="9" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`var(${colorVar})`}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          style={{ transition: "stroke-dashoffset .6s" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 32,
            lineHeight: 1,
            color: `var(${colorVar})`,
          }}
        >
          {grade ?? "–"}
        </div>
        <div className="faint tnum" style={{ fontSize: 12, marginTop: 2 }}>
          {score ?? "–"}/100
        </div>
      </div>
    </div>
  );
}
