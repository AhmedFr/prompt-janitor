import { useMemo, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/Card";
import { useUsageTab } from "./useUsageTab";
import {
  errorRateBars,
  isUsageEmpty,
  kindBars,
  kindLabel,
  seriesColumns,
  sessionBars,
  shortDay,
  toStackedSeries,
} from "./usageTab.util";
import {
  ErrorTooltip,
  KindTooltip,
  SeriesTooltip,
  SessionsTooltip,
} from "./UsageTab.tooltips";
import {
  AXIS_TICK,
  BAR_COLOR,
  BAR_RADIUS,
  BAR_RADIUS_HORIZONTAL,
  CHART_SERIES_LIMIT,
  ERROR_BAR_COLOR,
  GRID_STROKE,
  LINE_WIDTH,
  MAX_BAR_SIZE,
  SERIES_LIMIT,
  SERIES_VARS,
  UNMEASURED_BAR_COLOR,
} from "./UsageTab.constants";
import type { UsageTabBodyProps } from "./UsageTab.types";
import "./UsageTab.css";

/** Analytics → Usage: what the harness actually invoked, from the scan index. */
export function UsageTab() {
  const { data, loading } = useUsageTab();

  if (loading) {
    return (
      <Card padded>
        <div className="muted">Loading…</div>
      </Card>
    );
  }
  if (!data || isUsageEmpty(data)) {
    return (
      <Card padded>
        <div className="muted">No usage indexed yet — run a scan</div>
      </Card>
    );
  }
  return <UsageTabBody data={data} />;
}

/** The four usage charts, rendered from an overview the caller already has. */
export function UsageTabBody({ data }: UsageTabBodyProps) {
  const series = useMemo(() => data.top.slice(0, SERIES_LIMIT), [data.top]);
  const columns = useMemo(() => seriesColumns(series), [series]);
  const rows = useMemo(() => toStackedSeries(series), [series]);
  // The chart draws the leading few; the table below carries all of them.
  const drawn = useMemo(() => columns.slice(0, CHART_SERIES_LIMIT), [columns]);
  const kinds = useMemo(() => kindBars(data.by_kind), [data.by_kind]);
  const errors = useMemo(() => errorRateBars(data.mcp_error_rates), [data.mcp_error_rates]);
  const projects = useMemo(() => sessionBars(data.sessions_per_project), [data.sessions_per_project]);

  return (
    <div className="usage">
      <ChartCard id="usage-top" title="Top skills, agents and MCP servers over time">
        {series.length === 0 ? (
          <Empty>No invocations in the last 90 days.</Empty>
        ) : (
          <>
            <div className="usage-chart usage-chart--tall">
              <ResponsiveContainer>
                <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickFormatter={shortDay}
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={{ stroke: GRID_STROKE }}
                    minTickGap={28}
                  />
                  <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={SeriesTooltip} cursor={{ stroke: GRID_STROKE }} />
                  <Legend
                    iconType="plainline"
                    formatter={(value) => <span className="usage-legend__text">{value}</span>}
                  />
                  {drawn.map((col, i) => (
                    <Line
                      key={col.key}
                      // Linear, not monotone: a spline invents curvature
                      // between two daily counts that the data never had.
                      type="linear"
                      dataKey={col.key}
                      name={col.label}
                      stroke={SERIES_VARS[i]}
                      strokeWidth={LINE_WIDTH}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <details className="usage-details">
              <summary>
                Show the numbers
                {columns.length > drawn.length ? ` — all ${columns.length} series` : ""}
              </summary>
              <table className="usage-table" aria-label="Top targets by invocations">
                <thead>
                  <tr>
                    <th scope="col">Target</th>
                    <th scope="col">Kind</th>
                    <th scope="col">Invocations</th>
                    <th scope="col">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col, i) => (
                    <tr key={col.key}>
                      <th scope="row">
                        <span className="usage-swatch" style={{ background: SERIES_VARS[i] }} />
                        {col.label}
                      </th>
                      <td>{kindLabel(col.kind)}</td>
                      <td className="tnum">{col.total}</td>
                      <td className="tnum">{col.errors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </ChartCard>

      <div className="usage-row">
        <ChartCard id="usage-kind" title="Invocations by kind">
          {kinds.length === 0 ? (
            <Empty>Nothing invoked yet.</Empty>
          ) : (
            <div className="usage-chart">
              <ResponsiveContainer>
                <BarChart data={kinds} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={{ stroke: GRID_STROKE }}
                    interval={0}
                  />
                  <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={KindTooltip} cursor={{ fill: "var(--group)" }} />
                  <Bar
                    dataKey="total"
                    fill={BAR_COLOR}
                    radius={BAR_RADIUS}
                    maxBarSize={MAX_BAR_SIZE}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard id="usage-errors" title="MCP error rate">
          {errors.length === 0 ? (
            <Empty>No MCP calls recorded.</Empty>
          ) : (
            <div className="usage-chart">
              <ResponsiveContainer>
                <BarChart
                  layout="vertical"
                  data={errors}
                  margin={{ top: 8, right: 12, bottom: 0, left: 8 }}
                >
                  <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={{ stroke: GRID_STROKE }}
                    interval={0}
                  />
                  <YAxis
                    type="category"
                    dataKey="target"
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    width={90}
                  />
                  <Tooltip content={ErrorTooltip} cursor={{ fill: "var(--group)" }} />
                  <Bar
                    dataKey="pct"
                    fill={ERROR_BAR_COLOR}
                    radius={BAR_RADIUS_HORIZONTAL}
                    maxBarSize={MAX_BAR_SIZE}
                  >
                    {/* An unmeasured server is greyed, not scored: a critical-red
                        0% bar would read as a clean bill of health. */}
                    {errors.map((bar) => (
                      <Cell
                        key={bar.target}
                        fill={bar.measured ? ERROR_BAR_COLOR : UNMEASURED_BAR_COLOR}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard id="usage-sessions" title="Sessions per project">
        {projects.length === 0 ? (
          <Empty>No sessions recorded.</Empty>
        ) : (
          <div className="usage-chart">
            <ResponsiveContainer>
              <BarChart data={projects} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={{ stroke: GRID_STROKE }}
                  interval={0}
                />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={SessionsTooltip} cursor={{ fill: "var(--group)" }} />
                <Bar
                  dataKey="sessions"
                  fill={BAR_COLOR}
                  radius={BAR_RADIUS}
                  maxBarSize={MAX_BAR_SIZE}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

/** A card holding one titled, labelled chart region. */
function ChartCard({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card padded>
      <section aria-labelledby={id}>
        <h2 id={id} className="an-card__title">
          {title}
        </h2>
        {children}
      </section>
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="muted usage-empty">{children}</div>;
}
