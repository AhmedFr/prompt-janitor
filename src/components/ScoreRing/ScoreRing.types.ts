import type { GradeLetter } from "@/components/Grade";

export interface ScoreRingProps {
  /** 0–100 score; `null`/`undefined` renders an empty ring. */
  score: number | null | undefined;
  /** Grade letter, drives the ring color. */
  grade: GradeLetter | null | undefined;
  /** Diameter in px. Defaults to 120. */
  size?: number;
}
