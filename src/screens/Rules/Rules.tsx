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

export function Rules() {
  const { rules, loading, toggle, addRule, deleteRule } = useRules();
  const [pack, setPack] = useState<Pack>("all");
  const [title, setTitle] = useState("");
  const [pattern, setPattern] = useState("");
  const [sev, setSev] = useState<Sev>("mid");

  const shown = pack === "all" ? rules : rules.filter((r) => r.source === pack);
  const onCount = rules.filter((r) => r.enabled).length;

  const submit = async () => {
    if (!title.trim() || !pattern.trim()) return;
    await addRule(title.trim(), pattern.trim(), sev);
    setTitle("");
    setPattern("");
  };

  return (
    <section className="screen">
      <header className="screen__toolbar" data-tauri-drag-region>
        <h1 className="screen__title">Rules &amp; standards</h1>
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
                <div style={{ fontWeight: 600, marginBottom: 10 }}>Add a custom rule</div>
                <div className="col" style={{ gap: 8 }}>
                  <input
                    className="input"
                    placeholder="Rule name (e.g. Never reference Slack)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Forbidden text — flagged if it appears (e.g. slack)"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                  />
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
