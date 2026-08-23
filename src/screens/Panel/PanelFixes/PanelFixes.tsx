import { Grade } from "@/components/Grade";
import { plural } from "@/screens/Setup/setup.util";
import { fixLabel } from "../panel.util";
import { FIXES_TITLE, NOTHING_TO_FIX } from "./PanelFixes.constants";
import type { PanelFixesProps } from "./PanelFixes.types";
import "./PanelFixes.css";

/**
 * The three files worth opening the app for. Each row is a button, not a link:
 * clicking it raises the main window on that file's detail page, which is a
 * cross-window action rather than a navigation this window can make.
 *
 * One grade badge per row and nothing else: the row used to carry a folder
 * glyph on the left as well, which is two marks for the one fact that matters
 * on a 360 px row. The file leads, its project trails it in the muted colour,
 * and the issue count sits against the right edge where the eye can compare
 * three rows down a column.
 */
export function PanelFixes({ fixes, onOpen }: PanelFixesProps) {
  return (
    <section className="panel-fixes" aria-labelledby="panel-fixes-title">
      <h2 id="panel-fixes-title" className="sec panel-fixes__title">
        {FIXES_TITLE}
      </h2>
      {fixes.length === 0 ? (
        <p className="muted panel-fixes__empty">{NOTHING_TO_FIX}</p>
      ) : (
        <ul className="panel-fixes__list">
          {fixes.map((fix) => (
            <li key={fix.file_id}>
              <button
                type="button"
                className="panel-fix"
                // The row's columns read as one sentence to a screen reader;
                // the visible layout splits them across the panel's width.
                aria-label={fixLabel(fix)}
                onClick={() => onOpen(fix.file_id)}
              >
                <Grade grade={fix.grade} size="sm" />
                <span className="panel-fix__name">{fix.name}</span>
                <span className="panel-fix__project faint">{fix.project_name}</span>
                <span className="panel-fix__issues faint tnum">
                  {plural(fix.issue_count, "issue")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
