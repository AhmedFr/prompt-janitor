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

describe("AiTab key storage", () => {
  afterEach(cleanup);

  it("tells the user the key lives in the Keychain, per provider, and not in the database", () => {
    const ai: AiConfig = { provider: "anthropic", model: DEFAULT_MODELS.anthropic, has_key: true };
    const { getByLabelText, getByText } = render(
      <AiTab ai={ai} onSave={async () => {}} onTest={async () => ""} />,
    );
    const hint = getByText(/macOS Keychain, one entry per provider/);
    expect(hint).toHaveTextContent(/never in the app database/);
    const field = getByLabelText("API key");
    expect(field).toHaveAttribute("placeholder", expect.stringMatching(/in your Keychain — leave blank to keep/));
    // The hint is announced with the field, not just placed near it.
    expect(field.getAttribute("aria-describedby")).toContain(hint.id);
  });

  it("stops claiming a stored key once the user switches to a provider that has none", () => {
    const ai: AiConfig = { provider: "anthropic", model: DEFAULT_MODELS.anthropic, has_key: true };
    const { getByRole, getByLabelText } = render(
      <AiTab ai={ai} onSave={async () => {}} onTest={async () => ""} />,
    );
    fireEvent.click(getByRole("button", { name: "OpenRouter" }));
    expect(getByLabelText("API key")).toHaveAttribute("placeholder", "Paste your API key");
    // Switching back restores the truth for the saved provider.
    fireEvent.click(getByRole("button", { name: "Anthropic" }));
    expect(getByLabelText("API key")).toHaveAttribute(
      "placeholder",
      expect.stringMatching(/in your Keychain — leave blank to keep/),
    );
  });

  it("asks for a key when none is stored for the selected provider", () => {
    const ai: AiConfig = { provider: "openai", model: DEFAULT_MODELS.openai, has_key: false };
    const { getByLabelText } = render(
      <AiTab ai={ai} onSave={async () => {}} onTest={async () => ""} />,
    );
    expect(getByLabelText("API key")).toHaveAttribute("placeholder", "Paste your API key");
  });
});
