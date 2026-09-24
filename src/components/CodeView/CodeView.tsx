import { memo, useMemo, type CSSProperties } from "react";
import { highlightLines } from "./codeView.util";
import type { CodeViewProps } from "./CodeView.types";
import "./CodeView.css";

/**
 * A file as an editor shows it: numbered lines, syntax colour, nothing
 * reformatted. Long lines wrap inside their own row rather than scrolling the
 * pane sideways — the value at the end of a config line is usually what the
 * file was opened for — and the number stays pinned to the top of the row.
 *
 * The gutter is `aria-hidden` and `data-find-skip`, and every row is a
 * `data-find-block`, which is the whole contract with `FindBar`: search the
 * text, never the numbers, and never across a line break.
 *
 * Memoised: find re-renders the viewer on every keystroke, and reconciling
 * 5,000 unchanged rows each time is what made typing in a long file lag.
 */
export const CodeView = memo(function CodeView({ content, language, ariaLabel }: CodeViewProps) {
  const lines = useMemo(() => highlightLines(content, language), [content, language]);
  // The gutter is as wide as the largest line number, so a 5,000-line file
  // does not reflow its text when the reader scrolls past line 999.
  const gutter = `${String(lines.length).length}ch`;

  return (
    <div className="cv" role="region" aria-label={ariaLabel} style={{ "--cv-gutter": gutter } as CSSProperties}>
      {lines.map((tokens, i) => (
        <div className="cv__line" key={i} data-find-block="">
          <span className="cv__num" aria-hidden="true" data-find-skip="">
            {i + 1}
          </span>
          <span className="cv__text">
            {tokens.map((token, j) =>
              token.classes.length > 0 ? (
                <span key={j} className={token.classes.join(" ")}>
                  {token.text}
                </span>
              ) : (
                token.text
              ),
            )}
          </span>
        </div>
      ))}
    </div>
  );
});
