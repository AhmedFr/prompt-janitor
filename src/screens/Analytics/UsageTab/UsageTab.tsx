import { useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/Card";
import { RankedList } from "@/components/RankedList";
import type { InvocationKind } from "@/lib/ipc";
import { KIND_OPTIONS, SETUP_TAB_FOR_KIND, USAGE_KINDS } from "@/lib/usage";
import { useUsageTab as useUsageTabData } from "./useUsageTab";
import {
  inWindow,
  isUsageEmpty,
  kindBars,
  percentValue,
  rankedFor,
  sessionBars,
  tokenValue,
} from "./usageTab.util";
import { KindTooltip, SessionsTooltip } from "./UsageTab.tooltips";
import {
  AXIS_TICK,
  BAR_COLOR,
  BAR_RADIUS,
  DETAILS_LABEL,
  ERRORS_TITLE,
  ERROR_RATE_MAX,
  EXPENSIVE_TITLE,
  GRID_STROKE,
  KIND_CHART_EMPTY,
  KIND_CHART_TITLE,
  KIND_EMPTY,
  LOADING,
  MAX_BAR_SIZE,
  NOTHING_INVOKED,
  NOT_INDEXED,
  NO_ERRORS,
  NO_TOKENS,
  RANKED_LIMIT,
  SESSIONS_CHART_EMPTY,
  SESSIONS_CHART_TITLE,
  USED_TITLE,
} from "./UsageTab.constants";
import type { UsageTabBodyProps, UsageTabProps } from "./UsageTab.types";
import "./UsageTab.css";

/** Analytics → Usage: what the harness actually invoked, from the scan index. */
export function UsageTab({ windowDays, navigate }: UsageTabProps) {
  const { data, loading } = useUsageTabData(windowDays);

  if (loading) {
    return (
      <Card padded>
        <div className="muted">{LOADING}</div>
      </Card>
    );
  }
  if (!data || isUsageEmpty(data)) {
    return (
      <Card padded>
        <div className="muted">{NOT_INDEXED}</div>
      </Card>
    );
  }
  return <UsageTabBody data={data} navigate={navigate} />;
}

/** The three ranked lists plus the two usage charts, from an overview the caller has. */
export function UsageTabBody({ data, navigate }: UsageTabBodyProps) {
  const [kind, setKind] = useState<InvocationKind>(USAGE_KINDS[0]);
  const days = data.window_days;

  const used = useMemo(() => rankedFor(data.ranked, kind, "uses"), [data.ranked, kind]);
  const errors = useMemo(() => rankedFor(data.ranked, "all", "errors"), [data.ranked]);
  const expensive = useMemo(() => rankedFor(data.ranked, "all", "tokens"), [data.ranked]);
  const kinds = useMemo(() => kindBars(data.by_kind), [data.by_kind]);
  const projects = useMemo(() => sessionBars(data.sessions_per_project), [data.sessions_per_project]);

  // Built-ins ship with the harness, so there is no Setup row to open for
  // them — the link is left off rather than pointed at a tab that has no
  // answer.
  const setupTab = SETUP_TAB_FOR_KIND[kind];

  return (
    <div className="usage">
      <Card padded>
        <RankedList
          title={USED_TITLE}
          rows={used}
          limit={RANKED_LIMIT}
          selector={{
            options: KIND_OPTIONS,
            active: kind,
            onChange: (id) => setKind(id as InvocationKind),
          }}
          details={
            setupTab
              ? { label: DETAILS_LABEL, onClick: () => navigate("setup", setupTab) }
              : undefined
          }
          // The window held nothing at all, or held nothing of *this* kind:
          // two different facts, and telling the reader the first one when the
          // second is true sends them looking for a scan that already ran.
          empty={inWindow(data.ranked.length === 0 ? NOTHING_INVOKED : KIND_EMPTY[kind], days)}
        />
      </Card>

      <div className="usage-row">
        <Card padded>
          <RankedList
            title={ERRORS_TITLE}
            rows={errors}
            limit={RANKED_LIMIT}
            variant="error"
            // An error rate is a share of what can go wrong, not of the
            // worst row that happens to be on screen.
            max={ERROR_RATE_MAX}
            format={percentValue}
            empty={inWindow(NO_ERRORS, days)}
          />
        </Card>

        <Card padded>
          <RankedList
            title={EXPENSIVE_TITLE}
            rows={expensive}
            limit={RANKED_LIMIT}
            format={tokenValue}
            empty={inWindow(NO_TOKENS, days)}
          />
        </Card>
      </div>

      <div className="usage-row">
        <ChartCard id="usage-kind" title={KIND_CHART_TITLE}>
          {kinds.length === 0 ? (
            <Empty>{KIND_CHART_EMPTY}</Empty>
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

        <ChartCard id="usage-sessions" title={SESSIONS_CHART_TITLE}>
          {projects.length === 0 ? (
            <Empty>{SESSIONS_CHART_EMPTY}</Empty>
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
