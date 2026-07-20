/** Where a rule/issue comes from. Drives badge label + color. */
export type SourceId = "anthropic" | "openai" | "cursor" | "karpathy" | "custom";

export interface SourceMeta {
  label: string;
  className: string;
}

export interface SourceBadgeProps {
  source: SourceId;
}
