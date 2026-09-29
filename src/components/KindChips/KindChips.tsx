import { KIND_CHIP_ORDER, KIND_LABEL, LABEL } from "@/lib/vocabulary";
import type { KindChipsProps } from "./KindChips.types";
import "./KindChips.css";

/**
 * The kinds as a single-select radio group. A kind with no items is shown
 * disabled rather than hidden, so the row never reflows between projects.
 */
export function KindChips({ counts, active, onChange }: KindChipsProps) {
  return (
    <div className="kind-chips" role="radiogroup" aria-label="Kinds">
      {KIND_CHIP_ORDER.map((kind) => {
        const count = counts[kind] ?? 0;
        const on = kind === active;
        return (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={count === 0 && !on}
            className={"kind-chip" + (on ? " kind-chip--on" : "")}
            onClick={() => onChange(kind)}
          >
            {kind === "all" ? LABEL.all : KIND_LABEL[kind]}
            <span className="kind-chip__count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
