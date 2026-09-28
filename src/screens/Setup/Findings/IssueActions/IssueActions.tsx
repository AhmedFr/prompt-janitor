import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { SeverityDot } from "@/components/SeverityDot";
import { SourceBadge } from "@/components/SourceBadge";
import { commands, isTauri, type FixSuggestion } from "@/lib/ipc";
import { FOUNDER_PRICE, GET_PRO_LABEL, PAYMENTS_ENABLED, POLAR_CHECKOUT_URL } from "@/lib/monetization";
import { openExternal } from "@/lib/open-external";
import { FixDiff } from "../FixDiff";
import { applyFix as runApply, undoFix as runUndo } from "../fixActions";
import type { IssueActionsProps } from "./IssueActions.types";
import "./IssueActions.css";

/** The selected issue: its explanation, the suggested fix (static or a
 * provider-generated rewrite), and the Apply / Undo actions. */
export function IssueActions({
  issue,
  fileId,
  index,
  aiReady,
  entitled,
  onReload,
}: IssueActionsProps) {
  const [suggestion, setSuggestion] = useState<FixSuggestion | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<"" | "applying" | "undoing">("");
  const [status, setStatus] = useState<string | null>(null);
  const [commitGit, setCommitGit] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    if (!isTauri) return;
    void commands.hasBackup(fileId).then((r) => {
      if (r.status === "ok") setCanUndo(r.data);
    });
  }, [fileId]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    const res = await commands.suggestFix(fileId, index);
    if (res.status === "ok") setSuggestion(res.data);
    else setError(res.error);
    setGenerating(false);
  };

  const aiFix = suggestion ? { from: suggestion.from, to: suggestion.to } : null;
  const staticFix = issue.fix_from && issue.fix_to ? { from: issue.fix_from, to: issue.fix_to } : null;
  const fix = aiFix ?? staticFix;
  const paidAi = aiReady && entitled;

  const apply = async () => {
    if (!fix) return;
    setAction("applying");
    setStatus(null);
    const r = await runApply(fileId, [{ from: fix.from, to: fix.to }], commitGit, "manual");
    setStatus(r.message);
    if (r.ok) {
      setCanUndo(true);
      await onReload();
    }
    setAction("");
  };

  const undo = async () => {
    setAction("undoing");
    setStatus(null);
    const r = await runUndo(fileId);
    setStatus(r.message);
    if (r.ok) {
      setCanUndo(false);
      await onReload();
    }
    setAction("");
  };

  return (
    <Card padded style={{ marginTop: 20 }}>
      <div className="row" style={{ gap: 10, marginBottom: 8 }}>
        <SeverityDot level={issue.severity} />
        <div style={{ fontWeight: 600, fontSize: 14 }}>{issue.title}</div>
        <SourceBadge source={issue.source} />
        {issue.line != null && <span className="d-kbd">line {issue.line}</span>}
      </div>
      <div className="muted" style={{ maxWidth: 620 }}>
        {issue.why}
      </div>

      {paidAi && (
        <div className="row" style={{ gap: 8, marginTop: 14, alignItems: "center" }}>
          <Button size="sm" onClick={() => void generate()} disabled={generating || action !== ""}>
            <Icon name="sparkles" />{" "}
            {generating ? "Generating…" : suggestion ? "Regenerate" : "Suggest fix with AI"}
          </Button>
          {error && (
            <span className="faint" style={{ fontSize: 12, color: "var(--red)", maxWidth: 440 }}>
              {error}
            </span>
          )}
        </div>
      )}

      {fix && (
        <>
          <FixDiff from={fix.from} to={fix.to} note={suggestion?.note} ai={aiFix != null} />
          <div
            className="row"
            style={{ gap: 12, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}
          >
            <Button
              variant="primary"
              size="sm"
              onClick={() => void apply()}
              disabled={action !== ""}
            >
              <Icon name="check" /> {action === "applying" ? "Applying…" : "Apply fix"}
            </Button>
            {canUndo && (
              <Button size="sm" onClick={() => void undo()} disabled={action !== ""}>
                <Icon name="refresh" /> {action === "undoing" ? "Reverting…" : "Undo"}
              </Button>
            )}
            <label
              className="row"
              style={{ gap: 6, fontSize: 12, alignItems: "center", cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={commitGit}
                onChange={(e) => setCommitGit(e.target.checked)}
              />
              Commit to a git branch
            </label>
            {status && (
              <span className="faint" style={{ fontSize: 12 }}>
                {status}
              </span>
            )}
          </div>
        </>
      )}

      {!paidAi && (
        <div className="row" style={{ gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
          {!entitled ? (
            <>
              {PAYMENTS_ENABLED && (
                <Button
                  size="sm"
                  onClick={() => void openExternal(POLAR_CHECKOUT_URL)}
                  title={FOUNDER_PRICE}
                >
                  <Icon name="sparkles" /> {GET_PRO_LABEL}
                </Button>
              )}
              {PAYMENTS_ENABLED && (
                <span className="faint" style={{ fontSize: 12 }}>
                  ✦ AI auto-fix &amp; rewrites are a paid feature — {FOUNDER_PRICE}, or add a license
                  in <strong>Settings → License</strong>.
                </span>
              )}
            </>
          ) : (
            <span className="faint" style={{ fontSize: 12 }}>
              Connect an AI provider in <strong>Settings → AI</strong> to generate a tailored
              rewrite.
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
