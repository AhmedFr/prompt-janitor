import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { commands, type NlVerdict } from "@/lib/ipc";

/** Runs the built-in prompting standards (plus any custom NL rules, when
 * licensed) against a file via the AI provider, folding hits into the score. */
export function NlRulesPanel({
  fileId,
  onApplied,
}: {
  fileId: string;
  onApplied?: () => void;
}) {
  const [verdicts, setVerdicts] = useState<NlVerdict[] | null>(null);
  const [newScore, setNewScore] = useState<{ score: number; grade: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setBusy(true);
    setError(null);
    setVerdicts(null);
    setNewScore(null);
    const res = await commands.evaluateNlRules(fileId);
    if (res.status === "ok") {
      setVerdicts(res.data.verdicts);
      setNewScore({ score: res.data.score, grade: res.data.grade });
      onApplied?.();
    } else setError(res.error);
    setBusy(false);
  };

  return (
    <Card padded style={{ marginTop: 20 }}>
      <div className="row" style={{ gap: 10, alignItems: "center" }}>
        <span style={{ display: "flex", color: "var(--blue)" }}>
          <Icon name="sparkles" size={16} />
        </span>
        <div style={{ fontWeight: 600, fontSize: 14 }}>AI standards</div>
        <span className="toolbar-spacer" />
        <Button size="sm" onClick={() => void check()} disabled={busy}>
          {busy ? "Checking…" : "Check standards"}
        </Button>
      </div>
      <div className="muted" style={{ marginTop: 6, fontSize: 12.5, maxWidth: 620 }}>
        Audit this file against the built-in prompting standards (Anthropic, OpenAI, Cursor,
        community) — plus your own AI rules on the Pro tier. Violations fold into the score.
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
              All {verdicts.length} standard{verdicts.length === 1 ? "" : "s"} pass.
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

      {newScore && (
        <div className="faint" style={{ fontSize: 12, marginTop: 10 }}>
          Score is now {newScore.score} ({newScore.grade}).
        </div>
      )}
    </Card>
  );
}
