import { useEffect, useMemo, useState } from "react";
import { ScoreRing } from "@/components/ScoreRing";
import { SeverityDot } from "@/components/SeverityDot";
import { SourceBadge } from "@/components/SourceBadge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { commands, isTauri, type FileDetail, type FixSuggestion } from "@/lib/ipc";
import { openExternal } from "@/lib/open-external";
import { POLAR_CHECKOUT_URL, GET_PRO_LABEL, FOUNDER_PRICE } from "@/lib/monetization";
import type { Navigate } from "@/App/App.types";
import { useFileDetail } from "./useFileDetail";
import { applyFix as runApply, undoFix as runUndo } from "./fixActions";
import { NlRulesPanel } from "./NlRulesPanel";
import "./Detail.css";

export interface DetailProps {
  fileId: string | null;
  navigate: Navigate;
}

export function Detail({ fileId, navigate }: DetailProps) {
  const { detail, loading, aiReady, entitled, reload } = useFileDetail(fileId);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);

  useEffect(() => {
    if (!detail || detail.issues.length === 0) {
      setSelectedIndex(null);
      return;
    }
    const firstWithLine = detail.issues.findIndex((i) => i.line != null);
    setSelectedIndex(firstWithLine >= 0 ? firstWithLine : 0);
  }, [detail]);

  const fixable = detail?.issues.filter((i) => i.fix_from && i.fix_to).length ?? 0;
  // Auto-fix across the whole file is a paid feature, same as VerdictHero's
  // cross-file Auto-fix and the per-issue AI rewrite below.
  const autoFixLocked = !entitled;

  // Apply every deterministic (static) fix on the file in one snapshot.
  const runAutoFix = async () => {
    if (!detail) return;
    if (autoFixLocked) {
      void openExternal(POLAR_CHECKOUT_URL);
      return;
    }
    const edits = detail.issues
      .filter((i) => i.fix_from && i.fix_to)
      .map((i) => ({ from: i.fix_from as string, to: i.fix_to as string }));
    if (edits.length === 0) return;
    setAutoBusy(true);
    setAutoError(null);
    const r = await runApply(detail.id, edits, false);
    if (r.ok) await reload();
    else setAutoError(r.message);
    setAutoBusy(false);
  };

  return (
    <section className="screen">
      <header className="screen__toolbar" data-tauri-drag-region>
        <button className="d-back" onClick={() => navigate("prompts")} aria-label="Back to Prompts">
          <Icon name="chevronRight" size={14} />
        </button>
        <h1 className="screen__title">{detail?.name ?? "Prompt detail"}</h1>
        {detail && <span className="path faint">{detail.project}</span>}
        <span className="toolbar-spacer" />
        {detail && fixable > 0 && (
          <Button
            variant="primary"
            size="sm"
            disabled={autoBusy}
            onClick={() => void runAutoFix()}
            title={
              autoFixLocked
                ? "Auto-fix is a Pro feature — get a license"
                : "Apply every deterministic fix on this file"
            }
          >
            <Icon name={autoFixLocked ? "lock" : "wand"} />{" "}
            {autoBusy ? "Fixing…" : `Auto-fix ${fixable}`}
          </Button>
        )}
      </header>

      <div className="scroll-area">
        <div className="page" style={{ maxWidth: 1000 }}>
          {!isTauri ? (
            <Card padded>
              <div className="muted">Open the desktop app to view file detail.</div>
            </Card>
          ) : loading ? (
            <Card padded>
              <div className="muted">Loading…</div>
            </Card>
          ) : !detail ? (
            <Card padded>
              <div className="muted">Select a file from the Prompts tab.</div>
            </Card>
          ) : (
            <>
              {(autoError || (autoFixLocked && fixable > 0)) && (
                <div
                  className="row wrap"
                  style={{ gap: 10, marginBottom: 14, alignItems: "center" }}
                >
                  {autoError ? (
                    <span className="faint" style={{ fontSize: 12, color: "var(--red)", maxWidth: 620 }}>
                      {autoError}
                    </span>
                  ) : (
                    <span className="faint" style={{ fontSize: 12 }}>
                      ✦ Auto-fix across a whole file is a paid feature — {FOUNDER_PRICE}, or add a
                      license in <strong>Settings → License</strong>.
                    </span>
                  )}
                </div>
              )}
              <DetailBody
                detail={detail}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
                aiReady={aiReady}
                entitled={entitled}
                onReload={reload}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function DetailBody({
  detail,
  selectedIndex,
  onSelect,
  aiReady,
  entitled,
  onReload,
}: {
  detail: FileDetail;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  aiReady: boolean;
  entitled: boolean;
  onReload: () => Promise<void>;
}) {
  // Source lines + the first issue per line — recomputed only when the file
  // changes, not on every selection/hover render.
  const { lines, lineIssue } = useMemo(() => {
    const lines = detail.content.length ? detail.content.split("\n") : [];
    const lineIssue = new Map<number, number>();
    detail.issues.forEach((iss, idx) => {
      if (iss.line != null && !lineIssue.has(iss.line)) lineIssue.set(iss.line, idx);
    });
    return { lines, lineIssue };
  }, [detail]);
  const selected = selectedIndex != null ? detail.issues[selectedIndex] : null;
  const selectedLine = selected?.line ?? null;

  return (
    <>
      <div className="d-grid">
        <Card className="d-source">
          <div className="d-source-hd">
            <span className="path">{detail.path}</span>
            <span className="toolbar-spacer" />
            <span className="faint" style={{ fontSize: 11 }}>
              {lines.length} lines
            </span>
          </div>
          <div className="d-code">
            {lines.length === 0 ? (
              <div className="muted" style={{ padding: "0 16px" }}>
                (file is empty or unreadable)
              </div>
            ) : (
              lines.map((text, i) => {
                const lineNum = i + 1;
                const issueIdx = lineIssue.get(lineNum);
                const sev = issueIdx !== undefined ? detail.issues[issueIdx].severity : null;
                const cls = [
                  "d-line",
                  issueIdx !== undefined ? "d-line--issue" : "",
                  sev ? `d-line--${sev}` : "",
                  selectedLine === lineNum ? "d-line--sel" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <div
                    key={i}
                    className={cls}
                    role={issueIdx !== undefined ? "button" : undefined}
                    tabIndex={issueIdx !== undefined ? 0 : undefined}
                    aria-label={
                      issueIdx !== undefined
                        ? `Line ${lineNum}: ${detail.issues[issueIdx].title}`
                        : undefined
                    }
                    onClick={issueIdx !== undefined ? () => onSelect(issueIdx) : undefined}
                    onKeyDown={
                      issueIdx !== undefined
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onSelect(issueIdx);
                            }
                          }
                        : undefined
                    }
                  >
                    <span className="d-ln tnum">{lineNum}</span>
                    <span className="d-ltext">{text || " "}</span>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <div className="d-scorecard">
          <Card
            padded
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%" }}
          >
            <ScoreRing score={detail.score} grade={detail.grade} size={120} />
            {detail.delta != null && detail.delta !== 0 && (
              <div className="faint" style={{ fontSize: 12 }}>
                <span style={{ color: detail.delta > 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                  {detail.delta > 0 ? "+" : ""}
                  {detail.delta}
                </span>{" "}
                since last scan
              </div>
            )}
          </Card>
          <Card style={{ width: "100%" }}>
            <div className="d-source-hd">
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {detail.issues.length} issue{detail.issues.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="d-issue-list">
              {detail.issues.map((iss, idx) => (
                <button
                  key={idx}
                  className={"d-issue" + (selectedIndex === idx ? " d-issue--sel" : "")}
                  onClick={() => onSelect(idx)}
                >
                  <SeverityDot level={iss.severity} />
                  <span className="grow" style={{ fontSize: 12.5, fontWeight: 500 }}>
                    {iss.title}
                  </span>
                  <SourceBadge source={iss.source} />
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {selected && selectedIndex != null && (
        <IssuePanel
          key={selectedIndex}
          issue={selected}
          fileId={detail.id}
          index={selectedIndex}
          aiReady={aiReady}
          entitled={entitled}
          onReload={onReload}
        />
      )}

      {aiReady && <NlRulesPanel fileId={detail.id} onApplied={() => void onReload()} />}
    </>
  );
}

/** The selected issue: its explanation, the suggested fix (static or a
 * provider-generated rewrite), and the Apply / Undo actions. */
function IssuePanel({
  issue,
  fileId,
  index,
  aiReady,
  entitled,
  onReload,
}: {
  issue: FileDetail["issues"][number];
  fileId: string;
  index: number;
  aiReady: boolean;
  entitled: boolean;
  onReload: () => Promise<void>;
}) {
  const [suggestion, setSuggestion] = useState<FixSuggestion | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<"" | "applying" | "undoing">("");
  const [status, setStatus] = useState<string | null>(null);
  const [commitGit, setCommitGit] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
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
    const r = await runApply(fileId, [{ from: fix.from, to: fix.to }], commitGit);
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
              <Button
                size="sm"
                onClick={() => void openExternal(POLAR_CHECKOUT_URL)}
                title={FOUNDER_PRICE}
              >
                <Icon name="sparkles" /> {GET_PRO_LABEL}
              </Button>
              <span className="faint" style={{ fontSize: 12 }}>
                ✦ AI auto-fix &amp; rewrites are a paid feature — {FOUNDER_PRICE}, or add a license
                in <strong>Settings → License</strong>.
              </span>
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

/** Presentational from → to diff. */
function FixDiff({ from, to, note, ai }: { from: string; to: string; note?: string; ai?: boolean }) {
  return (
    <div style={{ marginTop: 14 }}>
      <h2 className="sec">{ai ? "AI suggested rewrite" : "Suggested fix"}</h2>
      {from && (
        <div className="d-diff-line d-diff-from" style={{ whiteSpace: "pre-wrap" }}>
          <span style={{ color: "var(--red)" }}>− </span>
          {from}
        </div>
      )}
      <div className="d-diff-line d-diff-to" style={{ whiteSpace: "pre-wrap" }}>
        <span style={{ color: "var(--green)" }}>+ </span>
        {to}
      </div>
      {note && (
        <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>
          {note}
        </div>
      )}
    </div>
  );
}
