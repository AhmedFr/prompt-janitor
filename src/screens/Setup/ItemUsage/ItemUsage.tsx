import { useState } from "react";
import "./ItemUsage.css";
import { LastUsedCell } from "@/components/DataTable/cells/LastUsedCell";
import { formatTokens } from "@/components/DataTable/cells/cells.util";
import { TrendChart } from "@/components/TrendChart";
import { USAGE_KINDS } from "@/lib/setupFilter";
import { BYTES_PER_TOKEN } from "../setup.unified";
import { DEFAULT_WINDOW, NO_USAGE, WINDOWS } from "./ItemUsage.constants";
import type { ItemUsageProps } from "./ItemUsage.types";
import { errorRatePerDay } from "./itemUsage.util";
import { useItemUsage } from "./useItemUsage";

function ProjectButtons({ projects, onSelect }: { projects: { path: string; name: string; note?: string }[]; onSelect: (path: string) => void }) {
  return (
    <ul className="item-usage__projects">
      {projects.map((p) => (
        <li key={p.path} className="item-usage__project">
          <button type="button" className="btn btn--ghost" onClick={() => onSelect(p.path)} aria-label={p.name}>
            {p.name}
          </button>
          {p.note && <span className="item-usage__muted">{p.note}</span>}
        </li>
      ))}
    </ul>
  );
}

/** The Usage tab: what the item cost and how it fared over time, or what an instruction file weighs. */
export function ItemUsage({ item, loadedIn, onSelectProject, usage: override }: ItemUsageProps) {
  const [windowDays, setWindowDays] = useState<30 | 90>(DEFAULT_WINDOW);
  const tracked = USAGE_KINDS.has(item.kind);
  const loaded = useItemUsage(tracked && override === undefined ? item.id : null, windowDays);
  const usage = override !== undefined ? override : loaded.usage;

  if (tracked) {
    return (
      <div className="item-usage">
        <div className="item-usage__windows">
          {WINDOWS.map((days) => (
            <button
              key={days}
              type="button"
              className="btn btn--ghost item-usage__window"
              aria-pressed={windowDays === days}
              onClick={() => setWindowDays(days)}
            >
              {days} days
            </button>
          ))}
        </div>
        {usage ? (
          <>
            <TrendChart data={usage.per_day} xKey="day" dataKey="uses" domain={[0, "auto"]} ariaLabel="Uses per day" />
            <TrendChart
              data={errorRatePerDay(usage.per_day)}
              xKey="day"
              dataKey="rate"
              domain={[0, 100]}
              ariaLabel="Error rate per day"
              valueDetail={(v) => `${v}% of uses errored`}
            />
          </>
        ) : (
          <p className="item-usage__muted">{loaded.loading ? "Loading…" : "No usage in this window."}</p>
        )}
        <dl className="item-usage__facts">
          <div className="item-usage__fact">
            <dt>Avg tokens per turn</dt>
            <dd>{formatTokens(usage?.avg_turn_tokens ?? item.usage?.avg_turn_tokens ?? null)}</dd>
          </div>
          <div className="item-usage__fact">
            <dt>Last used</dt>
            <dd>
              <LastUsedCell lastUsed={item.usage?.last_used ?? null} />
            </dd>
          </div>
        </dl>
        {usage && usage.by_project.length > 0 && (
          <ProjectButtons
            projects={usage.by_project.map((p) => ({ path: p.path, name: p.name, note: `${p.uses} uses` }))}
            onSelect={onSelectProject}
          />
        )}
      </div>
    );
  }

  if (item.kind === "rule") {
    return (
      <div className="item-usage">
        <p>≈{formatTokens(Math.round(item.bytes / BYTES_PER_TOKEN))} tokens, loaded every session</p>
        <h4>Loaded in</h4>
        <ProjectButtons projects={loadedIn} onSelect={onSelectProject} />
      </div>
    );
  }

  return <p className="item-usage__muted">{NO_USAGE}</p>;
}
