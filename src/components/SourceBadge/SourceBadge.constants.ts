import type { SourceId, SourceMeta } from "./SourceBadge.types";

export const SOURCES: Record<SourceId, SourceMeta> = {
  anthropic: { label: "Anthropic", className: "src--anthropic" },
  openai: { label: "OpenAI", className: "src--openai" },
  karpathy: { label: "Karpathy", className: "src--person" },
  custom: { label: "Your rule", className: "src--custom" },
};
