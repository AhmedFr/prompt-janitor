import type { UsageBadgeProps } from "./UsageBadge.types";
import { formatUsage } from "./usageBadge.util";
import "./UsageBadge.css";

/** Compact "used Nx · M sessions · last …" chip, colored by recency/error tone. */
export function UsageBadge({ usage, now = new Date() }: UsageBadgeProps) {
  const { label, tone } = formatUsage(usage, now);
  return (
    <span className="usage-badge" data-tone={tone}>
      {label}
    </span>
  );
}
