import { useEffect, useMemo, useState } from "react";
import { RadarChart } from "@/components/RadarChart";
import { SeverityDot } from "@/components/SeverityDot";
import { SourceBadge } from "@/components/SourceBadge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { isTauri, type FileDetail } from "@/lib/ipc";
import { openExternal } from "@/lib/open-external";
import { POLAR_CHECKOUT_URL, FOUNDER_PRICE, PAYMENTS_ENABLED } from "@/lib/monetization";
import type { Navigate } from "@/App/App.types";
import { useFileDetail } from "@/lib/useFileDetail";
import { fixableEdits } from "@/lib/fixableEdits";
import { useMergePosition } from "./useMergePosition";
import { AiChecks, IssueActions, applyFix as runApply, weakestTwo } from "@/screens/Setup/Findings";
import { MergePosition, type MergePositionState } from "./MergePosition";
import "@/styles/grades.css";
import "./Detail.css";

export interface DetailProps {
  fileId: string | null;
  navigate: Navigate;
}

export function Detail({ fileId, navigate }: DetailProps) {
  const { detail, loading, aiReady, entitled, reload } = useFileDetail(fileId);
  const mergePosition = useMergePosition(detail);
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
    const edits = fixableEdits(detail);
    if (edits.length === 0) return;
    setAutoBusy(true);
    setAutoError(null);
    const r = await runApply(detail.id, edits, false, "auto");
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
                    PAYMENTS_ENABLED && (
                      <span className="faint" style={{ fontSize: 12 }}>
                        ✦ Auto-fix across a whole file is a paid feature — {FOUNDER_PRICE}, or add a
                        license in <strong>Settings → License</strong>.
                      </span>
                    )
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
                mergePosition={mergePosition}
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
  mergePosition,
}: {
  detail: FileDetail;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  aiReady: boolean;
  entitled: boolean;
  onReload: () => Promise<void>;
  mergePosition: MergePositionState;
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
          <Card padded className="d-scorecard-card">
            <div className="row between">
              <span style={{ fontSize: 13, fontWeight: 600 }}>File scorecard</span>
              <span className={`d-scorecard-grade grade-fg--${detail.grade.toLowerCase()}`}>
                {detail.grade} · {detail.score}
              </span>
            </div>
            <RadarChart data={detail.dimensions} grade={detail.grade} />
            <div className="faint" style={{ fontSize: 12 }}>
              Weakest on {weakestTwo(detail.dimensions)}
            </div>
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
          {/* Before the issue list, because it reframes it: a rule file that
              loads everywhere carries its defects into every project. */}
          <MergePosition state={mergePosition} />
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
        <IssueActions
          key={selectedIndex}
          issue={selected}
          fileId={detail.id}
          index={selectedIndex}
          aiReady={aiReady}
          entitled={entitled}
          onReload={onReload}
        />
      )}

      {aiReady && (
        <AiChecks
          fileId={detail.id}
          content={detail.content}
          onApplied={() => void onReload()}
        />
      )}
    </>
  );
}
