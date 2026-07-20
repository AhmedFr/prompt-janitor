import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { SeverityDot } from "@/components/SeverityDot";
import { SourceBadge } from "@/components/SourceBadge";
import { Sparkline } from "@/components/Sparkline";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { VerdictHero, useVerdictHero } from "@/components/VerdictHero";
import { isTauri, type Overview as OverviewData } from "@/lib/ipc";
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
            {data.last_scan && (
              <span className="faint" style={{ fontSize: 12 }}>
                Last scan · {relativeTime(data.last_scan)}
              </span>
            )}
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
            <RealOverview
              data={data}
              navigate={navigate}
              scanning={scanning}
              onScanNow={() => void runScan(() => rescan(data.scan_folder ?? ""))}
            />
          ) : (
            <EmptyState scanning={scanning} progress={progress} onPick={() => void runScan(pickAndScan)} />
          )}
        </div>
      </div>
    </section>
  );
}

type SortMode = "crit" | "proj" | "new";

const SORTS: [SortMode, string][] = [
  ["crit", "Critical first"],
  ["proj", "By project"],
  ["new", "Newest"],
];

function RealOverview({
  data,
  navigate,
  scanning,
  onScanNow,
}: {
  data: OverviewData;
  navigate: Navigate;
  scanning: boolean;
  onScanNow: () => void;
}) {
  const { verdict, autoFixBusy, runAutoFix } = useVerdictHero();
  const [sort, setSort] = useState<SortMode>("crit");
  const worklist = useMemo(() => {
    const rank: Record<string, number> = { hi: 0, mid: 1, lo: 2 };
    const items = [...data.worklist];
    if (sort === "proj") {
      items.sort((a, b) => a.project.localeCompare(b.project) || rank[a.severity] - rank[b.severity]);
    } else if (sort === "new") {
      items.sort((a, b) => Number(b.modified ?? "0") - Number(a.modified ?? "0"));
    } else {
      items.sort((a, b) => rank[a.severity] - rank[b.severity]);
    }
    return items;
  }, [data.worklist, sort]);

  return (
    <>
      <VerdictHero
        data={data}
        verdict={verdict}
        scanning={scanning}
        autoFixBusy={autoFixBusy}
        onScanNow={onScanNow}
        onAutoFix={() => void runAutoFix()}
        navigate={navigate}
      />

      <div className="row between wrap" style={{ margin: "22px 0 12px", gap: 10 }}>
        <div className="ov-section">
          Needs attention <span className="faint tnum">· {data.worklist.length}</span>
        </div>
        <div className="seg">
          {SORTS.map(([key, label]) => (
            <button key={key} className={sort === key ? "on" : ""} onClick={() => setSort(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="ov-list">
          {worklist.map((item, i) => (
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
