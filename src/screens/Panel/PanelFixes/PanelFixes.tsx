import { Grade } from "@/components/Grade";
import { ProjectGlyph } from "@/components/ProjectGlyph";
import { plural } from "@/screens/Setup/setup.util";
import { fixLabel } from "../panel.util";
import { FIXES_TITLE, NOTHING_TO_FIX } from "./PanelFixes.constants";
import type { PanelFixesProps } from "./PanelFixes.types";
import "./PanelFixes.css";

/**
 * The three files worth opening the app for. Each row is a button, not a link:
 * clicking it raises the main window on that file's detail page, which is a
 * cross-window action rather than a navigation this window can make.
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
                <ProjectGlyph name={fix.project_name} grade={fix.grade} size={20} />
                <span className="panel-fix__name">{fix.name}</span>
                <span className="panel-fix__project faint">{fix.project_name}</span>
                <span className="panel-fix__issues faint tnum">
                  {plural(fix.issue_count, "issue")}
                </span>
                <Grade grade={fix.grade} size="sm" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
