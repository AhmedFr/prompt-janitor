import { describe, it, expect } from "vitest";
import { PROVIDERS, DEFAULT_MODELS } from "./AiTab.constants";

describe("AiTab provider catalog", () => {
  it("offers OpenRouter with an OpenAI-compatible default model", () => {
    expect(PROVIDERS.map(([id]) => id)).toEqual(["anthropic", "openai", "openrouter"]);
    expect(DEFAULT_MODELS.openrouter).toBe("anthropic/claude-sonnet-4.6");
  });
});
