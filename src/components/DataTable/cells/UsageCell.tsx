import { UsageBadge } from "@/components/UsageBadge";
import type { UsageCellProps } from "./cells.types";

/**
 * "used N× · M sessions · last …", toned by `formatUsage`. Reuses the badge
 * rather than re-styling the same string so the tone contrast pairs stay
 * measured in one place.
 */
export function UsageCell({ usage, now }: UsageCellProps) {
  return <UsageBadge usage={usage} now={now} />;
}
