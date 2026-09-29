import { useState } from "react";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { SeverityDot } from "@/components/SeverityDot";
import { SourceBadge } from "@/components/SourceBadge";
import { fixableEdits } from "@/lib/fixableEdits";
import { AiChecks } from "./AiChecks";
import { applyFix } from "./fixActions";
import { FIX_ALL, LOAD_FAILED, NO_FINDINGS, NOT_GRADED, SHOW_LINE } from "./Findings.constants";
import type { FindingsProps } from "./Findings.types";
import { findingKeys, weakestTwo } from "./findings.util";
import { IssueActions } from "./IssueActions";
import { useFindings } from "./useFindings";
import "@/styles/grades.css";
import "./Findings.css";

/**
 * The viewer's Findings tab: everything Detail did, in one column (spec §6.2).
 * A finding has two affordances: the row expands in place (why + fixes), and
 * its line link jumps to that line in Content → Source. Jumping leaves this
 * tab, so it is never what a row click does.
 *
 * The open finding is tracked by its key and the file it belongs to, so it
 * closes when another file is shown, and after any fix: the list reloads and
 * shifts, and nothing else may inherit the open panel.
 */
export function Findings({ fileId, onJumpToLine, onChanged, findings }: FindingsProps) {
  const { detail, loading, aiReady, entitled, reload } = useFindings(fileId, findings);
  const [open, setOpen] = useState<{ fileId: string | null; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (fileId === null) return <p className="muted findings__empty">{NOT_GRADED}</p>;
  if (loading) return <p className="muted findings__empty">Loading…</p>;
  if (!detail) {
    return (
      <div className="findings__failed">
        <p className="muted findings__empty">{LOAD_FAILED}</p>
        <Button size="sm" onClick={() => void reload()}>Retry</Button>
      </div>
    );
  }

  const edits = fixableEdits(detail);
  const keys = findingKeys(detail.id, detail.issues);
  const openKey = open?.fileId === fileId ? open.key : null;
  const refresh = async () => {
    await reload();
    setOpen(null);
    onChanged?.();
  };
  const fixAll = async () => {
    setBusy(true);
    setError(null);
    const r = await applyFix(detail.id, edits, false, "auto");
    if (r.ok) await refresh();
    else setError(r.message);
    setBusy(false);
  };

  return (
    <div className="findings">
      <div className="findings__score">
        <span className={`findings__grade grade-fg--${detail.grade.toLowerCase()}`}>{detail.grade} · {detail.score}</span>
        <span className="muted">Weakest on {weakestTwo(detail.dimensions)}</span>
        <span className="toolbar-spacer" />
        {edits.length > 0 && (
          <Button size="sm" variant="primary" disabled={busy} onClick={() => void fixAll()}>
            <Icon name="wand" /> {busy ? "Fixing…" : FIX_ALL(edits.length)}
          </Button>
        )}
      </div>
      {error && <p className="findings__error" role="alert">{error}</p>}
      {detail.issues.length === 0 ? (
        <p className="muted findings__empty">{NO_FINDINGS}</p>
      ) : (
        <ul className="findings__list">
          {detail.issues.map((issue, index) => (
            <li key={keys[index]}>
              <div className="findings__row">
                <button
                  type="button"
                  className={"findings__item" + (openKey === keys[index] ? " findings__item--on" : "")}
                  aria-expanded={openKey === keys[index]}
                  onClick={() => setOpen(openKey === keys[index] ? null : { fileId, key: keys[index] })}
                >
                  <SeverityDot level={issue.severity} />
                  <span className="grow">{issue.title}</span>
                  <SourceBadge source={issue.source} />
                </button>
                {issue.line != null && (
                  <button
                    type="button"
                    className="findings__line tnum"
                    aria-label={SHOW_LINE(issue.line)}
                    onClick={() => onJumpToLine(issue.line as number)}
                  >
                    L{issue.line}
                  </button>
                )}
              </div>
              {openKey === keys[index] && (
                <IssueActions key={keys[index]} issue={issue} fileId={detail.id} index={index}
                  aiReady={aiReady} entitled={entitled} onReload={refresh} />
              )}
            </li>
          ))}
        </ul>
      )}
      {aiReady && <AiChecks fileId={detail.id} content={detail.content} onApplied={() => void refresh()} />}
    </div>
  );
}
