import type { SourceBadgeProps } from "./SourceBadge.types";
import { SOURCES } from "./SourceBadge.constants";
import "./SourceBadge.css";

/** Attribution badge tying an issue/rule back to its guidebook or the user's own rule. */
export function SourceBadge({ source }: SourceBadgeProps) {
  const meta = SOURCES[source];
  return <span className={`src ${meta.className}`}>{meta.label}</span>;
}
