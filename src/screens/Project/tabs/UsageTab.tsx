import { useMemo, useState } from "react";
import { RankedList } from "@/components/RankedList";
import { TrendChart } from "@/components/TrendChart";
import type { InvocationKind } from "@/lib/ipc";
import { KIND_OPTIONS, USAGE_KINDS } from "@/lib/usage";
import {
  NO_HARNESS_NOTE,
  SESSIONS_CHART_LABEL,
  SESSIONS_CHART_TITLE,
  USAGE_EMPTY,
  USAGE_KIND_EMPTY,
  USAGE_LIMIT,
  USAGE_TITLE,
  USAGE_UNREADABLE,
} from "../Project.constants";
import { usageRows } from "../project.util";
import type { UsageTabProps } from "./tabs.types";

/** Sessions have no ceiling, so the chart scales to its own busiest day. */
const SESSIONS_DOMAIN: [number, "auto"] = [0, "auto"];

/**
 * What the agent actually reached for inside this project, and how often the
 * project was worked in at all. The ranking answers "is what I installed
 * here earning its place"; the daily series is the context that keeps a low
 * count from reading as a dead skill when the whole project was quiet.
 */
export function UsageTab({ usage, harness }: UsageTabProps) {
  const [kind, setKind] = useState<InvocationKind>(USAGE_KINDS[0]);
  // Keyed on `usage` rather than on `usage?.ranked`: the optional chain is a
  // fresh expression every render, so a memo depending on it never hits.
  const rows = useMemo(() => usageRows(usage?.ranked ?? [], kind), [usage, kind]);
  const rankedCount = usage?.ranked.length ?? 0;
  const days = usage?.sessions_per_day ?? [];

  // Same three absences the load order distinguishes, for the same reason.
  if (!harness) return <p className="muted project-note">{NO_HARNESS_NOTE}</p>;
  if (!usage) return <p className="project-note project-note--error">{USAGE_UNREADABLE}</p>;

  return (
    <div className="project-usage">
      <RankedList
        title={USAGE_TITLE}
        rows={rows}
        limit={USAGE_LIMIT}
        // The window held nothing at all, or held nothing of *this* kind:
        // two different facts, and telling the reader the first one when the
        // second is true sends them looking for a scan that already ran.
        empty={rankedCount === 0 ? USAGE_EMPTY : USAGE_KIND_EMPTY[kind]}
        selector={{
          options: KIND_OPTIONS,
          active: kind,
          onChange: (id) => setKind(id as InvocationKind),
        }}
      />

      {days.length > 0 && (
        <section className="project-usage__chart" aria-label={SESSIONS_CHART_TITLE}>
          <h3 className="project-usage__chart-title">{SESSIONS_CHART_TITLE}</h3>
          <TrendChart
            data={days}
            xKey="day"
            dataKey="count"
            domain={SESSIONS_DOMAIN}
            ariaLabel={SESSIONS_CHART_LABEL}
            height={120}
          />
        </section>
      )}
    </div>
  );
}
