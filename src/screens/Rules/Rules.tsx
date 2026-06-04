import { useState } from "react";
import { Card } from "@/components/Card";
import { SeverityDot } from "@/components/SeverityDot";
import { SourceBadge } from "@/components/SourceBadge";
import { isTauri } from "@/lib/ipc";
import { useRules } from "./useRules";

type Pack = "all" | "anthropic" | "openai" | "karpathy" | "custom";

const PACKS: [Pack, string][] = [
  ["all", "All"],
  ["anthropic", "Anthropic"],
  ["openai", "OpenAI"],
  ["karpathy", "Karpathy"],
  ["custom", "Custom"],
];

export function Rules() {
  const { rules, loading, toggle } = useRules();
  const [pack, setPack] = useState<Pack>("all");

  const shown = pack === "all" ? rules : rules.filter((r) => r.source === pack);
  const onCount = rules.filter((r) => r.enabled).length;

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
