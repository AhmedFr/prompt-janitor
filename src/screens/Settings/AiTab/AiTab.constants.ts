/** Selectable AI backends: [id, label]. "Off" is handled separately in AiTab.tsx. */
export const PROVIDERS: [string, string][] = [
  ["anthropic", "Anthropic"],
  ["openai", "OpenAI"],
  ["openrouter", "OpenRouter"],
];

/** Model shown as a placeholder when the user has not typed one. */
export const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o-mini",
  openrouter: "anthropic/claude-sonnet-4.6",
};
