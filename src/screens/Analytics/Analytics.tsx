import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card } from "@/components/Card";
import { Grade } from "@/components/Grade";
import { Button } from "@/components/Button";
import { TrendChart } from "@/components/TrendChart";
import { isTauri, type Analytics as AnalyticsData } from "@/lib/ipc";
import type { Navigate } from "@/App/App.types";
import { useAnalytics } from "./useAnalytics";
import { gradeBars, issueBars } from "./analytics.util";
import "./Analytics.css";

export interface AnalyticsProps {
  navigate: Navigate;
}

/** range_days options for the toolbar toggle. */
const RANGES: [number, string][] = [
  [7, "7d"],
  [30, "30d"],
  [90, "90d"],
];

const DEFAULT_RANGE_DAYS = 30;

/** Caption for the Overall-tile delta, keyed by the active range_days. */
const DELTA_CAPTION: Record<number, string> = {
  7: "vs last week",
  30: "vs last month",
  90: "vs last quarter",
};

export function Analytics({ navigate }: AnalyticsProps) {
  const [rangeDays, setRangeDays] = useState(DEFAULT_RANGE_DAYS);
  const { data, loading } = useAnalytics(rangeDays);

  return (
    <section className="screen">
      <header className="screen__toolbar" data-tauri-drag-region>
        <h1 className="screen__title">Analytics</h1>
        <span className="toolbar-spacer" />
        <div className="seg" role="group" aria-label="Time range">
          {RANGES.map(([days, label]) => (
            <button
              key={days}
              className={rangeDays === days ? "on" : ""}
              aria-pressed={rangeDays === days}
              onClick={() => setRangeDays(days)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="scroll-area">
        <div className="page" style={{ maxWidth: 1000 }}>
          {!isTauri ? (
            <Card padded>
              <div className="muted">Open the desktop app to see analytics.</div>
            </Card>
          ) : loading ? (
            <Card padded>
              <div className="muted">Loading…</div>
            </Card>
          ) : !data || data.files_tracked === 0 ? (
            <Card padded>
              <div className="muted">No data yet — scan a folder from the Overview tab.</div>
            </Card>
          ) : (
            <AnalyticsBody data={data} navigate={navigate} rangeDays={rangeDays} />
          )}
        </div>
      </div>
    </section>
  );
}

function AnalyticsBody({
  data,
  navigate,
  rangeDays,
}: {
  data: AnalyticsData;
  navigate: Navigate;
  rangeDays: number;
}) {
  const bars = useMemo(() => gradeBars(data.grade_distribution), [data.grade_distribution]);
  const issues = useMemo(() => issueBars(data.common_issues), [data.common_issues]);

  return (
    <>
      <div className="an-tiles">
        <Card padded className="an-tile">
          <div className="an-tile__grade">
            <Grade grade={data.overall_grade} size="sm" />
            <span className="an-tile__value tnum">{data.overall_score}</span>
          </div>
          <div className="faint an-tile__label">Overall</div>
          {data.overall_delta !== 0 && (
            <div
              className="an-tile__sub tnum"
              style={{ color: data.overall_delta > 0 ? "var(--green)" : "var(--red)" }}
            >
              {data.overall_delta > 0 ? "▲" : "▼"} {data.overall_delta > 0 ? "+" : ""}
              {data.overall_delta} {DELTA_CAPTION[rangeDays] ?? "vs last month"}
            </div>
          )}
        </Card>

        <Card padded className="an-tile">
          <div className="an-tile__value tnum">{data.files_tracked}</div>
          <div className="faint an-tile__label">Files tracked</div>
          <div className="an-tile__sub faint">
            across {data.project_count} project{data.project_count === 1 ? "" : "s"}
          </div>
        </Card>

        <Card padded className="an-tile">
          <div className="an-tile__value tnum">{data.issues_fixed_total}</div>
          <div className="faint an-tile__label">Issues fixed</div>
          <div className="an-tile__sub faint">
            {data.issues_fixed_auto} auto · {data.issues_fixed_manual} manual
          </div>
        </Card>

        <Card padded className="an-tile">
          <div
            className="an-tile__value tnum"
            style={{ color: data.open_issues > 0 ? "var(--red)" : "var(--text)" }}
          >
            {data.open_issues}
          </div>
          <div className="faint an-tile__label">Open issues</div>
          <div className="an-tile__sub faint">{data.open_critical} critical</div>
        </Card>
      </div>

      <Card padded style={{ marginTop: 18 }}>
        <div className="an-card__title">Grade distribution</div>
        <div className="an-chart" role="img" aria-label="Grade distribution">
          <ResponsiveContainer>
            <BarChart data={bars} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <XAxis dataKey="grade" tickLine={false} axisLine={false} tick={{ fill: "var(--text-2)", fontSize: 12 }} />
              <YAxis hide allowDecimals={false} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive maxBarSize={56}>
                {bars.map((b) => (
                  <Cell key={b.grade} fill={`var(${b.colorVar})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="an-row">
        <Card padded>
          <div className="an-card__title">Health trend</div>
          <div style={{ marginTop: 8 }}>
            <TrendChart data={data.trend} />
          </div>
        </Card>

        <Card padded>
          <div className="an-card__title">Most common issues</div>
          {issues.length === 0 ? (
            <div className="muted" style={{ marginTop: 10 }}>
              No recurring issues — nice work.
            </div>
          ) : (
            <div className="an-issues">
              {issues.map((issue) => (
                <div key={issue.title} className="an-issue">
                  <div className="an-issue__row">
                    <span className="an-issue__title">{issue.title}</span>
                    <span className="faint tnum">{issue.files_affected}</span>
                  </div>
                  <div className="an-issue__bar">
                    <i style={{ width: `${issue.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="row" style={{ marginTop: 18, justifyContent: "flex-end" }}>
        <Button size="sm" onClick={() => navigate("prompts")}>
          View all prompts →
        </Button>
      </div>
    </>
  );
}
