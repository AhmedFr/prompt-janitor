import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { AiTab } from "./AiTab";
import { PROVIDERS, DEFAULT_MODELS } from "./AiTab.constants";
import type { AiConfig } from "@/lib/ipc";

describe("AiTab provider catalog", () => {
  it("offers OpenRouter with an OpenAI-compatible default model", () => {
    expect(PROVIDERS.map(([id]) => id)).toEqual(["anthropic", "openai", "openrouter"]);
    expect(DEFAULT_MODELS.openrouter).toBe("anthropic/claude-sonnet-4.6");
  });
});

describe("AiTab provider switch", () => {
  afterEach(cleanup);

  it("resets the model to the new provider's default when it was at the outgoing default", () => {
    const ai: AiConfig = { provider: "anthropic", model: DEFAULT_MODELS.anthropic, has_key: false };
    const { getByRole, getByLabelText } = render(
      <AiTab ai={ai} onSave={async () => {}} onTest={async () => ""} />,
    );
    fireEvent.click(getByRole("button", { name: "OpenRouter" }));
    expect(getByLabelText("Model")).toHaveValue(DEFAULT_MODELS.openrouter);
  });

  it("keeps a custom model the user typed when switching providers", () => {
    const ai: AiConfig = { provider: "anthropic", model: "my-custom-model", has_key: false };
    const { getByRole, getByLabelText } = render(
      <AiTab ai={ai} onSave={async () => {}} onTest={async () => ""} />,
    );
    fireEvent.click(getByRole("button", { name: "OpenRouter" }));
    expect(getByLabelText("Model")).toHaveValue("my-custom-model");
  });
});
