import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { commands, type NlVerdict } from "@/lib/ipc";

/** Runs the user's natural-language rules against a file via the AI provider. */
export function NlRulesPanel({ fileId }: { fileId: string }) {
  const [verdicts, setVerdicts] = useState<NlVerdict[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setBusy(true);
    setError(null);
    const res = await commands.evaluateNlRules(fileId);
    if (res.status === "ok") setVerdicts(res.data);
    else setError(res.error);
    setBusy(false);
  };

  return (
    <Card padded style={{ marginTop: 20 }}>
      <div className="row" style={{ gap: 10, alignItems: "center" }}>
        <span style={{ display: "flex", color: "var(--blue)" }}>
          <Icon name="sparkles" size={16} />
        </span>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Custom AI rules</div>
        <span className="toolbar-spacer" />
        <Button size="sm" onClick={() => void check()} disabled={busy}>
          {busy ? "Checking…" : "Check custom rules"}
        </Button>
      </div>
      <div className="muted" style={{ marginTop: 6, fontSize: 12.5, maxWidth: 620 }}>
        Evaluate your natural-language rules against this file using the configured provider.
      </div>

      {error && (
        <div className="faint" style={{ fontSize: 12, color: "var(--red)", marginTop: 10 }}>
          {error}
        </div>
      )}

      {verdicts && verdicts.length === 0 && (
        <div className="faint" style={{ fontSize: 12, marginTop: 10 }}>
          No natural-language rules yet — add one on the Rules tab.
        </div>
      )}

      {verdicts && verdicts.length > 0 && (
        <div className="col" style={{ gap: 10, marginTop: 12 }}>
          {verdicts.every((v) => !v.violates) && (
            <div className="faint" style={{ fontSize: 12, color: "var(--green)" }}>
              All {verdicts.length} custom rule{verdicts.length === 1 ? "" : "s"} pass.
            </div>
          )}
          {verdicts.map((v) => (
            <div key={v.rule_id} className="row" style={{ gap: 10, alignItems: "flex-start" }}>
              <span
                style={{
                  display: "flex",
                  marginTop: 1,
                  color: v.violates ? "var(--red)" : "var(--green)",
                }}
              >
                <Icon name={v.violates ? "x" : "check"} size={15} />
              </span>
              <div className="grow">
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: v.violates ? "var(--red)" : "var(--text)",
                  }}
                >
                  {v.title}
                </div>
                <div className="faint" style={{ fontSize: 12 }}>
                  {v.explanation}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
