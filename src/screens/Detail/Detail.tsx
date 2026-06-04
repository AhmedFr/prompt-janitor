import { useEffect, useState } from "react";
import { ScoreRing } from "@/components/ScoreRing";
import { SeverityDot } from "@/components/SeverityDot";
import { SourceBadge } from "@/components/SourceBadge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { isTauri, type FileDetail } from "@/lib/ipc";
import type { Navigate } from "@/App/App.types";
import { useFileDetail } from "./useFileDetail";
import "./Detail.css";

export interface DetailProps {
  fileId: string | null;
  navigate: Navigate;
}

export function Detail({ fileId, navigate }: DetailProps) {
  const { detail, loading } = useFileDetail(fileId);
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
            <DetailBody detail={detail} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
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
}: {
  detail: FileDetail;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
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
          <Card padded style={{ display: "flex", justifyContent: "center", width: "100%" }}>
            <ScoreRing score={detail.score} grade={detail.grade} size={120} />
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

      {selected && (
        <Card padded style={{ marginTop: 20 }}>
          <div className="row" style={{ gap: 10, marginBottom: 8 }}>
            <SeverityDot level={selected.severity} />
            <div style={{ fontWeight: 600, fontSize: 14 }}>{selected.title}</div>
            <SourceBadge source={selected.source} />
            {selected.line != null && <span className="d-kbd">line {selected.line}</span>}
          </div>
          <div className="muted" style={{ maxWidth: 620 }}>
            {selected.why}
          </div>
          {selected.fix_from && selected.fix_to && (
            <div style={{ marginTop: 14 }}>
              <h2 className="sec">Suggested fix</h2>
              <div className="d-diff-line d-diff-from">
                <span style={{ color: "var(--red)" }}>− </span>
                {selected.fix_from}
              </div>
              <div className="d-diff-line d-diff-to">
                <span style={{ color: "var(--green)" }}>+ </span>
                {selected.fix_to}
              </div>
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <Button variant="primary" size="sm" disabled title="Auto-fix arrives in Phase 4 (paid)">
                  <Icon name="check" /> Apply fix
                </Button>
                <Button size="sm" disabled>
                  Dismiss
                </Button>
              </div>
              <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>
                Auto-fix &amp; AI rewrites arrive in Phase 4 (paid).
              </div>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
