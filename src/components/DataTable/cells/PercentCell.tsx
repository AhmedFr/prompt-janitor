import { Icon } from "@/components/Icon";
import "./cells.css";
import type { PercentCellProps } from "./cells.types";
import { EMPTY_MARK, formatPercent, rateTone } from "./cells.util";

/**
 * Right-aligned percentage from a 0–1 fraction; a muted "—" when unknown.
 *
 * Given `thresholds`, the number is toned green / amber / red. Red also gets
 * a warning glyph and a heavier weight, so a bad rate still stands out to
 * someone who cannot tell the three inks apart — colour is the third signal,
 * never the only one.
 */
export function PercentCell({ value, thresholds }: PercentCellProps) {
  const text = formatPercent(value);
  const tone = thresholds ? rateTone(value, thresholds) : undefined;

  if (text === EMPTY_MARK) {
    return <span className="dt-num muted">{text}</span>;
  }

  if (tone === "bad" && thresholds) {
    const why = `at or above the ${formatPercent(thresholds.bad)} line`;
    return (
      <span className="dt-num" data-tone="bad" title={`${text} — ${why}`}>
        <span className="dt-num__alert">
          <Icon name="alert" size={12} />
        </span>
        {text}
        <span className="sr-only">, {why}</span>
      </span>
    );
  }

  return (
    <span className="dt-num" data-tone={tone}>
      {text}
    </span>
  );
}
