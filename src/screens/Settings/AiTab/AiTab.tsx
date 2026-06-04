import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import type { AiTabProps } from "./AiTab.types";

const PROVIDERS: [string, string][] = [
  ["none", "Off"],
  ["anthropic", "Anthropic"],
  ["openai", "OpenAI"],
];

const DEFAULT_MODEL: Record<string, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o-mini",
};

const fieldStyle = { display: "block", marginTop: 12 } as const;
const labelStyle = { display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6 } as const;

/** Settings → AI: pick a provider, store a BYO key locally, test the connection. */
export function AiTab({ ai, onSave, onTest }: AiTabProps) {
  const [provider, setProvider] = useState("none");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "test">("");
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!ai) return;
    setProvider(ai.provider);
    setModel(ai.model);
    setHasKey(ai.has_key);
  }, [ai]);

  const persist = async () => {
    await onSave(provider, apiKey, model);
    if (apiKey) setHasKey(true);
    setApiKey("");
  };

  const save = async () => {
    setBusy("save");
    setResult(null);
    await persist();
    setBusy("");
    setResult("Saved");
  };

  const test = async () => {
    setBusy("test");
    setResult(null);
    await persist();
    const msg = await onTest();
    setBusy("");
    setResult(msg);
  };

  const off = provider === "none";

  return (
    <>
      <h2 className="set-sec">AI provider</h2>
      <Card padded>
        <p className="faint" style={{ fontSize: 12, marginBottom: 12, maxWidth: 560 }}>
          Bring your own API key to power auto-fix and natural-language rules. The key is stored
          locally and only ever sent to the provider you pick.
        </p>

        <div className="seg" style={{ marginBottom: 4 }}>
          {PROVIDERS.map(([key, label]) => (
            <button
              key={key}
              className={provider === key ? "on" : ""}
              onClick={() => setProvider(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {!off && (
          <>
            <label style={fieldStyle}>
              <span style={labelStyle}>API key</span>
              <input
                className="input"
                type="password"
                value={apiKey}
                placeholder={hasKey ? "•••••••• stored — leave blank to keep" : "Paste your API key"}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Model</span>
              <input
                className="input"
                value={model}
                placeholder={DEFAULT_MODEL[provider] ?? ""}
                onChange={(e) => setModel(e.target.value)}
              />
            </label>
          </>
        )}

        <div className="row" style={{ gap: 8, marginTop: 16, alignItems: "center" }}>
          <Button size="sm" variant="primary" onClick={() => void save()} disabled={busy !== ""}>
            <Icon name="check" /> {busy === "save" ? "Saving…" : "Save"}
          </Button>
          {!off && (
            <Button size="sm" onClick={() => void test()} disabled={busy !== ""}>
              <Icon name="sparkles" /> {busy === "test" ? "Testing…" : "Test connection"}
            </Button>
          )}
          {result && (
            <span className="faint" style={{ fontSize: 13 }}>
              {result}
            </span>
          )}
        </div>
      </Card>
    </>
  );
}
