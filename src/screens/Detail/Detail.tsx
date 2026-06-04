import { useEffect, useState } from "react";
import { ScoreRing } from "@/components/ScoreRing";
import { SeverityDot } from "@/components/SeverityDot";
import { SourceBadge } from "@/components/SourceBadge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { commands, isTauri, type FileDetail, type FixSuggestion } from "@/lib/ipc";
import type { Navigate } from "@/App/App.types";
import { useFileDetail } from "./useFileDetail";
import "./Detail.css";

export interface DetailProps {
  fileId: string | null;
  navigate: Navigate;
}

export function Detail({ fileId, navigate }: DetailProps) {
  const { detail, loading, aiReady } = useFileDetail(fileId);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!detail || detail.issues.length === 0) {
      setSelectedIndex(null);
      return;
    }
    const firstWithLine = detail.issues.findIndex((i) => i.line != null);
    setSelectedIndex(firstWithLine >= 0 ? firstWithLine : 0);
  }, [detail]);

  const fixable = detail?.issues.filter((i) => i.fix_to).length ?? 0;

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
          <Button variant="primary" size="sm" disabled title="Auto-fix arrives in Phase 4 (paid)">
            <Icon name="wand" /> Auto-fix {fixable}
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
            <DetailBody
              detail={detail}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              aiReady={aiReady}
            />
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
}: {
  detail: FileDetail;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  aiReady: boolean;
}) {
  const lines = detail.content.length ? detail.content.split("\n") : [];
  const lineIssue = new Map<number, number>();
  detail.issues.forEach((iss, idx) => {
    if (iss.line != null && !lineIssue.has(iss.line)) lineIssue.set(iss.line, idx);
  });
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
                    onClick={issueIdx !== undefined ? () => onSelect(issueIdx) : undefined}
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
        />
      )}
    </>
  );
}

/** The selected issue: its explanation, plus the suggested fix — static by
 * default, replaced by a provider-generated rewrite once the user asks. */
function IssuePanel({
  issue,
  fileId,
  index,
  aiReady,
}: {
  issue: FileDetail["issues"][number];
  fileId: string;
  index: number;
  aiReady: boolean;
}) {
  const [suggestion, setSuggestion] = useState<FixSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    const res = await commands.suggestFix(fileId, index);
    if (res.status === "ok") setSuggestion(res.data);
    else setError(res.error);
    setBusy(false);
  };

  const staticFix = issue.fix_from && issue.fix_to ? { from: issue.fix_from, to: issue.fix_to } : null;

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

      {aiReady && (
        <div className="row" style={{ gap: 8, marginTop: 14, alignItems: "center" }}>
          <Button variant="primary" size="sm" onClick={() => void generate()} disabled={busy}>
            <Icon name="sparkles" />{" "}
            {busy ? "Generating…" : suggestion ? "Regenerate" : "Suggest fix with AI"}
          </Button>
          {error && (
            <span className="faint" style={{ fontSize: 12, color: "var(--red)", maxWidth: 440 }}>
              {error}
            </span>
          )}
        </div>
      )}

      {suggestion ? (
        <FixDiff from={suggestion.from} to={suggestion.to} note={suggestion.note} ai />
      ) : staticFix ? (
        <FixDiff from={staticFix.from} to={staticFix.to} />
      ) : null}

      {!aiReady && (
        <div className="faint" style={{ fontSize: 12, marginTop: 12 }}>
          Connect an AI provider in <strong>Settings → AI</strong> to generate a tailored rewrite.
        </div>
      )}
    </Card>
  );
}

/** A from → to diff with an Apply action (applying lands in #26). */
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
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <Button variant="primary" size="sm" disabled title="Applying fixes arrives in #26">
          <Icon name="check" /> Apply fix
        </Button>
        <Button size="sm" disabled>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
