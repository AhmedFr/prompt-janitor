import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { SeverityDot } from "@/components/SeverityDot";
import { SourceBadge } from "@/components/SourceBadge";
import { isTauri } from "@/lib/ipc";
import { useRules } from "./useRules";

type Pack = "all" | "anthropic" | "openai" | "karpathy" | "custom";
type Sev = "hi" | "mid" | "lo";

const PACKS: [Pack, string][] = [
  ["all", "All"],
  ["anthropic", "Anthropic"],
  ["openai", "OpenAI"],
  ["karpathy", "Karpathy"],
  ["custom", "Custom"],
];

const SEVERITIES: [Sev, string][] = [
  ["hi", "Critical"],
  ["mid", "Warning"],
  ["lo", "Nit"],
];

type Mode = "pattern" | "nl";

export function Rules() {
  const { rules, loading, aiReady, entitled, toggle, addRule, addNlRule, deleteRule, importPack } =
    useRules();
  const nlReady = aiReady && entitled;
  const [pack, setPack] = useState<Pack>("all");
  const [mode, setMode] = useState<Mode>("pattern");
  const [title, setTitle] = useState("");
  const [pattern, setPattern] = useState("");
  const [sev, setSev] = useState<Sev>("mid");
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const doImport = async () => {
    const n = await importPack();
    if (n > 0) {
      setImportMsg(`Imported ${n} rule${n === 1 ? "" : "s"}`);
      window.setTimeout(() => setImportMsg(null), 4000);
    }
  };

  const shown = pack === "all" ? rules : rules.filter((r) => r.source === pack);
  const onCount = rules.filter((r) => r.enabled).length;

  const submit = async () => {
    if (!title.trim() || !pattern.trim()) return;
    if (mode === "nl") await addNlRule(title.trim(), pattern.trim(), sev);
    else await addRule(title.trim(), pattern.trim(), sev);
    setTitle("");
    setPattern("");
  };

  return (
    <section className="screen">
      <header className="screen__toolbar" data-tauri-drag-region>
        <h1 className="screen__title">Rules &amp; standards</h1>
        <span className="toolbar-spacer" />
        {importMsg && (
          <span className="faint" style={{ fontSize: 12, color: "var(--green)" }}>
            {importMsg}
          </span>
        )}
        <Button size="sm" onClick={() => void doImport()}>
          <Icon name="plus" /> Import pack
        </Button>
      </header>
      <div className="scroll-area">
        <div className="page">
          {!isTauri ? (
            <Card padded>
              <div className="muted">Open the desktop app to manage rules.</div>
            </Card>
          ) : loading ? (
            <Card padded>
              <div className="muted">Loading…</div>
            </Card>
          ) : (
            <>
              {/* composer */}
              <Card padded style={{ borderStyle: "dashed", borderColor: "var(--sep-strong)", marginBottom: 18 }}>
                <div className="row between wrap" style={{ gap: 10, marginBottom: 10 }}>
                  <div style={{ fontWeight: 600 }}>Add a custom rule</div>
                  <div className="seg">
                    <button
                      className={mode === "pattern" ? "on" : ""}
                      onClick={() => setMode("pattern")}
                    >
                      Pattern
                    </button>
                    <button
                      className={mode === "nl" ? "on" : ""}
                      disabled={!nlReady}
                      title={
                        nlReady
                          ? undefined
                          : !entitled
                            ? "Paid feature — add a license in Settings → License"
                            : "Connect an AI provider in Settings → AI"
                      }
                      onClick={() => setMode("nl")}
                    >
                      <Icon name="sparkles" size={13} /> Natural language
                    </button>
                  </div>
                </div>
                <div className="col" style={{ gap: 8 }}>
                  <input
                    className="input"
                    placeholder="Rule name (e.g. Never reference Slack)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder={
                      mode === "nl"
                        ? "Describe the rule (e.g. Must define an explicit output format)"
                        : "Forbidden text — flagged if it appears (e.g. slack)"
                    }
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                  />
                </div>
                <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>
                  {mode === "nl"
                    ? "Evaluated by your AI provider when you check a file on its detail page."
                    : "Free & deterministic — flags any file that contains the text."}
                </div>
                <div className="row between wrap" style={{ marginTop: 12, gap: 10 }}>
                  <div className="seg">
                    {SEVERITIES.map(([key, label]) => (
                      <button key={key} className={sev === key ? "on" : ""} onClick={() => setSev(key)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!title.trim() || !pattern.trim()}
                    onClick={() => void submit()}
                  >
                    <Icon name="plus" /> Add rule
                  </Button>
                </div>
              </Card>

              {/* header + filters */}
              <div className="row between wrap" style={{ marginBottom: 14, gap: 10 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>
                  Active rules <span className="faint tnum">· {onCount} on</span>
                </div>
                <div className="row wrap" style={{ gap: 6 }}>
                  {PACKS.map(([key, label]) => (
                    <button
                      key={key}
                      className={"chip" + (pack === key ? " on" : "")}
                      onClick={() => setPack(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {shown.length === 0 ? (
                <Card padded>
                  <div className="muted">No rules in this pack yet.</div>
                </Card>
              ) : (
                <div className="col" style={{ gap: 10 }}>
                  {shown.map((r) => (
                    <Card key={r.id} padded>
                      <div className="row" style={{ gap: 13 }}>
                        <SeverityDot level={r.severity} />
                        <div className="grow">
                          <div style={{ fontWeight: 600 }}>{r.title}</div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                            {r.description}
                          </div>
                        </div>
                        {r.nl && (
                          <span
                            className="chip on"
                            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            <Icon name="sparkles" size={12} /> AI
                          </span>
                        )}
                        <SourceBadge source={r.source} />
                        {r.custom && (
                          <button
                            className="icon-btn"
                            aria-label={`Delete ${r.title}`}
                            onClick={() => void deleteRule(r.id)}
                          >
                            <Icon name="x" size={14} />
                          </button>
                        )}
                        <button
                          className={"switch" + (r.enabled ? " on" : "")}
                          role="switch"
                          aria-checked={r.enabled}
                          aria-label={r.title}
                          onClick={() => void toggle(r.id, !r.enabled)}
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
