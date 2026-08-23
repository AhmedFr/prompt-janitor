import type { ScoreRingProps } from "./ScoreRing.types";
import {
  GRADE_COLOR_VAR,
  LETTER_RATIO,
  SCORE_LINE_MIN_SIZE,
  SCORE_MIN_FONT_SIZE,
  SCORE_RATIO,
} from "./ScoreRing.constants";

/**
 * Radial gauge showing a 0–100 score with its grade letter at the center.
 *
 * The type scales with the ring rather than sitting at a fixed 32 px: the same
 * component is drawn at 120 (verdict hero, onboarding), 78 (project header) and
 * 56 (menu-bar panel), and fixed type overflowed the stroke at the small end.
 */
export function ScoreRing({ score, grade, size = 120 }: ScoreRingProps) {
  const radius = size / 2 - 9;
  const circumference = 2 * Math.PI * radius;
  const pct = (score ?? 0) / 100;
  const colorVar = GRADE_COLOR_VAR[grade ?? "C"];
  const letterSize = Math.round(size * LETTER_RATIO);
  // Two stacked lines need a ring big enough for both; a small one keeps the
  // letter, which is the part that is legible at a glance anyway.
  const showsScore = size >= SCORE_LINE_MIN_SIZE;
  const scoreSize = Math.max(SCORE_MIN_FONT_SIZE, Math.round(size * SCORE_RATIO));

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
            fontSize: letterSize,
            lineHeight: 1,
            color: `var(${colorVar})`,
          }}
        >
          {grade ?? "–"}
        </div>
        {showsScore && (
          <div className="faint tnum" style={{ fontSize: scoreSize, marginTop: 2 }}>
            {score ?? "–"}/100
          </div>
        )}
      </div>
    </div>
  );
}
