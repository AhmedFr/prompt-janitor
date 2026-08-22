import { useId } from "react";
import type { RankedListProps } from "./RankedList.types";
import { rankRows } from "./rankedList.util";
import "./RankedList.css";

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

const defaultFormat = (v: number) => v.toLocaleString();

/**
 * The screenshot pattern: rows of `label · inline bar (share of max) · value`,
 * an optional selector above and a "Details" link below. Bars are
 * `--bar-fill` by default, `--bar-fill-error` under `variant="error"`; `max`
 * pins what "full width" means when the values have a natural ceiling.
 */
export function RankedList({
  title,
  rows,
  selector,
  limit = 10,
  max: maxProp,
  variant = "default",
  format = defaultFormat,
  details,
  empty,
}: RankedListProps) {
  const { rows: ranked, max: sliceMax } = rankRows(rows, limit);
  // A caller's ceiling wins over the slice's own top value; `<= 0` is not a
  // denominator, so it falls through to "no bar" rather than to NaN.
  const max = maxProp !== undefined ? maxProp : sliceMax;
  const headingId = useId();

  return (
    // Named via the visible heading rather than a duplicated `aria-label` —
    // the title only has to be spelled out once, in `.rl__title`.
    <section className="rl" aria-labelledby={headingId}>
      <header className="rl__header">
        <h3 className="rl__title" id={headingId}>
          {title}
        </h3>
        {selector && (
          <div className="rl__selector" role="group" aria-label={`${title} view`}>
            {selector.options.map((option) => {
              const on = option.id === selector.active;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={cx("rl__chip", on && "rl__chip--on")}
                  aria-pressed={on}
                  onClick={() => selector.onChange(option.id)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {ranked.length === 0 ? (
        <p className="rl__empty">{empty}</p>
      ) : (
        <ul className="rl__list" data-variant={variant}>
          {ranked.map((row) => {
            const width = max > 0 ? (row.value / max) * 100 : 0;
            const inner = (
              <>
                {row.glyph && (
                  <span className="rl__glyph" aria-hidden="true">
                    {row.glyph}
                  </span>
                )}
                <span className="rl__label">{row.label}</span>
                {/* `.rl__bar-track` wraps `.rl__bar` — a deviation from the
                    brief's bare `<div class="rl__bar">` — so the unfilled
                    share of the row has a visible track to be a share OF;
                    without it a low-value bar reads as empty space, not as
                    "small compared to the max". See task-3-report.md. */}
                <span className="rl__bar-track">
                  <span className="rl__bar" style={{ width: `${width}%` }} />
                </span>
                <span className="rl__value tnum">{format(row.value)}</span>
                {row.secondary && <span className="rl__secondary tnum">{row.secondary}</span>}
              </>
            );
            return (
              <li key={row.id} className="rl__row" title={row.title}>
                {row.onClick ? (
                  <button type="button" className="rl__row-btn" onClick={row.onClick}>
                    {inner}
                  </button>
                ) : (
                  <div className="rl__row-inner">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {details && (
        <button type="button" className="rl__details" onClick={details.onClick}>
          {details.label}
        </button>
      )}
    </section>
  );
}
