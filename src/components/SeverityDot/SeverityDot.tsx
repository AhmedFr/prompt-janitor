import type { SeverityDotProps } from "./SeverityDot.types";
import "./SeverityDot.css";

const LABELS = { hi: "Critical", mid: "Warning", lo: "Nit" } as const;

/** Small colored dot indicating issue severity (critical / warning / nit). */
export function SeverityDot({ level }: SeverityDotProps) {
  return <span className={`sev sev--${level}`} role="img" aria-label={LABELS[level]} />;
}
