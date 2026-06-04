import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Grade } from "@/components/Grade";
import { SeverityDot } from "@/components/SeverityDot";
import { SourceBadge } from "@/components/SourceBadge";
import { Sparkline } from "@/components/Sparkline";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { isTauri, type Overview as OverviewData } from "@/lib/ipc";
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
  const { data, loading, refetch } = useOverview();
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
            <Button size="sm" onClick={() => void runScan(pickAndScan)} disabled={scanning}>
              <Icon name="folder" /> Change folder…
            </Button>
            <Button size="sm" onClick={() => void runScan(() => rescan(data.scan_folder ?? ""))} disabled={scanning}>
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
            <RealOverview data={data} navigate={navigate} />
          ) : (
            <EmptyState scanning={scanning} progress={progress} onPick={() => void runScan(pickAndScan)} />
          )}
        </div>
      </div>
    </section>
  );
}

function RealOverview({ data, navigate }: { data: OverviewData; navigate: Navigate }) {
  return (
    <>
      <Card padded>
        <div className="row between wrap" style={{ gap: 18 }}>
          <div className="row" style={{ gap: 16 }}>
            <Grade grade={data.overall_grade} size="xl" />
            <div>
              <div className="ov-title">Overall health</div>
              <div className="muted" style={{ marginTop: 2 }}>
                {data.file_count} prompt files · {data.project_count} projects
              </div>
              {data.scan_folder && (
                <div className="path faint" style={{ marginTop: 2 }}>
                  {data.scan_folder}
                </div>
              )}
            </div>
          </div>
          {data.trend.length > 1 && (
            <div style={{ width: 200 }}>
              <div className="row between" style={{ fontSize: 12 }}>
                <span className="muted">Health trend</span>
              </div>
              <div style={{ marginTop: 6 }}>
                <Sparkline data={data.trend} height={42} />
              </div>
            </div>
          )}
        </div>

        <div className="bar" style={{ marginTop: 16 }}>
          <i style={{ width: `${data.overall_score}%` }} />
        </div>
        <div className="row" style={{ gap: 18, marginTop: 12, fontSize: 12 }}>
          <span className="row" style={{ gap: 6 }}>
            <SeverityDot level="hi" /> {data.critical} critical
          </span>
          <span className="row" style={{ gap: 6 }}>
            <SeverityDot level="mid" /> {data.warnings} warnings
          </span>
          <span className="row" style={{ gap: 6 }}>
            <SeverityDot level="lo" /> {data.nits} nits
          </span>
        </div>
      </Card>

      <div className="row between" style={{ margin: "22px 0 12px" }}>
        <div className="ov-section">
          Needs attention <span className="faint tnum">· {data.worklist.length}</span>
        </div>
      </div>

      <Card>
        <div className="ov-list">
          {data.worklist.map((item, i) => (
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
