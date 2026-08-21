import { useMemo, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { SeverityDot } from "@/components/SeverityDot";
import { SourceBadge } from "@/components/SourceBadge";
import { Sparkline } from "@/components/Sparkline";
import { Heatmap, bucketFiles } from "@/components/Heatmap";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { useVerdictHero, verdictSentence } from "@/components/VerdictHero";
import { isTauri, type FileRow, type Overview as OverviewData } from "@/lib/ipc";
import { relativeTime } from "@/lib/format";
import { pickAndScan, rescan } from "@/lib/scan-actions";
import type { Navigate } from "@/App/App.types";
import { useOverview } from "./useOverview";
import "./Overview.css";

interface Progress {
  done: number;
  total: number;
}

export interface OverviewProps {
  navigate: Navigate;
}

export function Overview({ navigate }: OverviewProps) {
  const { data, files, loading, refetch } = useOverview();
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    if (!isTauri) return;
    const unlisten = listen<Progress>("scan-progress", (e) => setProgress(e.payload));
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const runScan = async (action: () => Promise<unknown>) => {
    setScanning(true);
    try {
      await action();
      await refetch();
    } finally {
      setScanning(false);
      setProgress(null);
    }
  };

  return (
    <section className="screen">
      <header className="screen__toolbar" data-tauri-drag-region>
        <h1 className="screen__title">Overview</h1>
        <span className="toolbar-spacer" />
        {data?.has_data && (
          <>
            {data.last_scan && (
              <span className="faint" style={{ fontSize: 12 }}>
                Last scan · {relativeTime(data.last_scan)}
              </span>
            )}
            <Button size="sm" onClick={() => void runScan(pickAndScan)} disabled={scanning}>
              <Icon name="folder" /> Change folder…
            </Button>
            <Button size="sm" onClick={() => void runScan(() => rescan())} disabled={scanning}>
              <Icon name="refresh" /> {scanning ? "Scanning…" : "Scan now"}
            </Button>
          </>
        )}
      </header>

      <div className="scroll-area">
        <div className="page">
          {!isTauri ? (
            <Card padded>
              <div className="muted">Open the Prompt Janitor desktop app to see live data.</div>
            </Card>
          ) : loading ? (
            <Card padded>
              <div className="muted">Loading…</div>
            </Card>
          ) : data?.has_data ? (
            <RealOverview data={data} files={files} navigate={navigate} />
          ) : (
            <EmptyState scanning={scanning} progress={progress} onPick={() => void runScan(pickAndScan)} />
          )}
        </div>
      </div>
    </section>
  );
}

const SEVERITY_RANK: Record<string, number> = { hi: 0, mid: 1, lo: 2 };

/** Top 5 worklist items by severity — the "Biggest wins" section. */
const BIGGEST_WINS_COUNT = 5;

function RealOverview({
  data,
  files,
  navigate,
}: {
  data: OverviewData;
  files: FileRow[];
  navigate: Navigate;
}) {
  const { verdict, autoFixBusy, runAutoFix } = useVerdictHero();
  const { legend } = useMemo(() => bucketFiles(files), [files]);
  const failing = files.filter((f) => f.grade === "F").length;
  const poor = files.filter((f) => f.grade === "D").length;
  const wins = useMemo(
    () =>
      [...data.worklist]
        .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
        .slice(0, BIGGEST_WINS_COUNT),
    [data.worklist],
  );

  return (
    <>
      <Card padded>
        <div className="ov-hero">
          <div className={`ov-hero__grade grade-bg--${data.overall_grade.toLowerCase()}`}>
            {data.overall_grade}
          </div>
          <div className="grow">
            <div className="ov-hero__title">{verdictSentence(data.overall_grade, verdict.fixesToA)}</div>
            <div className="muted ov-hero__meta">
              {data.file_count} files · {data.project_count} projects · <strong>{data.overall_score}</strong>/100
              {data.trend_delta !== 0 && (
                <span style={{ color: data.trend_delta > 0 ? "var(--green)" : "var(--red)", marginLeft: 8 }}>
                  ▲ {data.trend_delta > 0 ? "+" : ""}
                  {data.trend_delta} this week
                </span>
              )}
            </div>
          </div>
          <div className="ov-hero__legend">
            {legend.map((l) => (
              <span key={l.grade} className="ov-legend__item">
                <i className={`grade-bg--${l.grade.toLowerCase()}`} /> {l.count}
              </span>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <Heatmap files={files} onSelect={(id) => navigate("detail", id)} />
        </div>
        <div className="faint ov-hero__caption">
          Each square is one file, sorted best → worst.
          {failing > 0 && (
            <>
              {" "}
              <span style={{ color: "var(--red)" }}>{failing} failing</span>
            </>
          )}
          {poor > 0 && (
            <>
              {" "}
              and <span style={{ color: "var(--grade-d)" }}>{poor} poor</span> files pull the average down.
            </>
          )}
        </div>
      </Card>

      {verdict.autofixCount > 0 && (
        <Card padded className="ov-autofix">
          <span className="ov-autofix__ico">
            <Icon name="wand" />
          </span>
          <div className="grow">
            <div style={{ fontWeight: 600 }}>{verdict.autofixCount} issues can be fixed automatically</div>
            <div className="faint" style={{ fontSize: 12 }}>
              Safe rewrites only · you review a diff before anything is written
            </div>
          </div>
          <Button variant="primary" size="sm" disabled={autoFixBusy} onClick={() => void runAutoFix()}>
            <Icon name="wand" /> Auto-fix {verdict.autofixCount}
          </Button>
        </Card>
      )}

      <div className="row between wrap" style={{ margin: "22px 0 12px", gap: 10 }}>
        <div className="ov-section">Biggest wins</div>
      </div>

      <Card>
        <div className="ov-list">
          {wins.map((item, i) => (
            <button key={i} className="ov-row" onClick={() => navigate("detail", item.file_id)}>
              <SeverityDot level={item.severity} />
              <div className="grow">
                <div style={{ fontWeight: 500 }}>{item.title}</div>
                <div className="path" style={{ marginTop: 2 }}>
                  {item.location}
                </div>
              </div>
              <SourceBadge source={item.source} />
              <span className="ov-chev">
                <Icon name="chevronRight" size={16} />
              </span>
            </button>
          ))}
        </div>
      </Card>

      {data.trend.length > 1 && (
        <Card padded style={{ marginTop: 22 }}>
          <div className="row between" style={{ fontSize: 12 }}>
            <span className="muted">Health trend</span>
            {data.trend_delta !== 0 && (
              <span style={{ color: data.trend_delta > 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                {data.trend_delta > 0 ? "+" : ""}
                {data.trend_delta} this week
              </span>
            )}
          </div>
          <div style={{ marginTop: 6 }}>
            <Sparkline data={data.trend} height={42} />
          </div>
        </Card>
      )}
    </>
  );
}

function EmptyState({
  scanning,
  progress,
  onPick,
}: {
  scanning: boolean;
  progress: Progress | null;
  onPick: () => void;
}) {
  return (
    <Card padded>
      <div className="ov-empty">
        <div className="ov-section" style={{ fontSize: 17, color: "var(--text-2)" }}>
          No prompts scanned yet
        </div>
        <div className="muted" style={{ maxWidth: 380 }}>
          Choose a folder and Prompt Janitor will find and grade your AGENTS.md, CLAUDE.md, and other AI prompt files.
        </div>
        {scanning ? (
          <div style={{ width: 280 }}>
            <div className="bar">
              <i
                style={{
                  width: `${progress && progress.total ? (progress.done / progress.total) * 100 : 6}%`,
                  transition: "width .15s",
                }}
              />
            </div>
            <div className="faint tnum" style={{ fontSize: 12, marginTop: 6 }}>
              {progress ? `${progress.done} of ${progress.total} files` : "Scanning…"}
            </div>
          </div>
        ) : (
          <Button variant="primary" onClick={onPick}>
            <Icon name="folder" /> Choose a folder…
          </Button>
        )}
      </div>
    </Card>
  );
}
