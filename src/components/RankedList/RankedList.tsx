import type { RankedListProps } from "./RankedList.types";
import { rankRows } from "./rankedList.util";
import "./RankedList.css";

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

const defaultFormat = (v: number) => v.toLocaleString();

/**
 * The screenshot pattern: rows of `label · inline bar (share of max) · value`,
 * an optional selector above and a "Details" link below. Bars are `--blue-tint`
 * by default, `--tone-error-tint` under `variant="error"`.
 */
export function RankedList({
  title,
  rows,
  selector,
  limit = 10,
  variant = "default",
  format = defaultFormat,
  details,
  empty,
}: RankedListProps) {
  const { rows: ranked, max } = rankRows(rows, limit);

  return (
    <section className="rl" aria-label={title}>
      <header className="rl__header">
        <h3 className="rl__title">{title}</h3>
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
                <span className="rl__bar-track">
                  <span className="rl__bar" style={{ width: `${width}%` }} />
                </span>
                <span className="rl__value tnum">{format(row.value)}</span>
                {row.secondary && <span className="rl__secondary tnum">{row.secondary}</span>}
              </>
            );
            return (
              <li key={row.id} className="rl__row">
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
