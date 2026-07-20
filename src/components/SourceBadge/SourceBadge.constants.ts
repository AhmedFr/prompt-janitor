import type { SourceId, SourceMeta } from "./SourceBadge.types";

export const SOURCES: Record<SourceId, SourceMeta> = {
  anthropic: { label: "Anthropic", className: "src--anthropic" },
  openai: { label: "OpenAI", className: "src--openai" },
  cursor: { label: "Cursor", className: "src--cursor" },
  karpathy: { label: "Karpathy", className: "src--person" },
  custom: { label: "Your rule", className: "src--custom" },
};
