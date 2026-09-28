import { FILTER_WORD } from "./SummaryLine.constants";
import type { SummaryLineProps } from "./SummaryLine.types";
import "./SummaryLine.css";

const FILTERS = ["never", "errors", "cost"] as const;

/** `[C] 84 items · 3 never used · 1 erroring · 2 costly` — each count a toggle filter (spec §4.2). */
export function SummaryLine({ grade, items, counts, active, onFilter, badge }: SummaryLineProps) {
  return (
    <div className="summary-line">
      {badge ?? (grade && <span className={`summary-grade grade-tint--${grade.toLowerCase()}`}>{grade}</span>)}
      <span>
        {items} {items === 1 ? "item" : "items"}
      </span>
      {FILTERS.filter((f) => counts[f] > 0 || active === f).map((f) => (
        <button
          key={f}
          type="button"
          className={`summary-filter summary-filter--${f}`}
          aria-pressed={active === f}
          onClick={() => onFilter(active === f ? "all" : f)}
        >
          {counts[f]} {FILTER_WORD[f]}
        </button>
      ))}
    </div>
  );
}
