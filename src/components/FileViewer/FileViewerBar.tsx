import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { FIND_BUTTON, FIND_SHORTCUT, MODE_GROUP_LABEL, MODE_LABEL } from "./FileViewer.constants";
import type { ViewMode } from "./FileViewer.types";

interface FileViewerBarProps {
  /** More than one draws the Rendered / Source toggle; one draws `language` instead. */
  modes: ViewMode[];
  mode: ViewMode;
  onMode: (mode: ViewMode) => void;
  /** "JSON", "Plain text" — what a source-only file is; `null` before the format is known. */
  language: string | null;
  /** "142 lines · 4.1 KB", or nothing before the read lands. */
  stats: string | null;
  /** Absent while there is nothing to search. */
  onFind?: () => void;
  actions?: ReactNode;
}

/** The viewer's one row of chrome: how to look at the file, how big it is, what to do with it. */
export function FileViewerBar({ modes, mode, onMode, language, stats, onFind, actions }: FileViewerBarProps) {
  return (
    <div className="fv__bar">
      {modes.length > 1 ? (
        <div className="seg fv__modes" role="group" aria-label={MODE_GROUP_LABEL}>
          {modes.map((m) => (
            <button key={m} type="button" className={m === mode ? "on" : ""} aria-pressed={m === mode} onClick={() => onMode(m)}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      ) : (
        language && <span className="fv__lang">{language}</span>
      )}
      {stats && <span className="fv__stats">{stats}</span>}
      <span className="fv__spacer" />
      {onFind && (
        <button type="button" className="tool-btn" aria-label={FIND_BUTTON} title={`${FIND_BUTTON} (${FIND_SHORTCUT})`} onClick={onFind}>
          <Icon name="search" size={14} />
          <kbd className="fv__kbd" aria-hidden="true">
            {FIND_SHORTCUT}
          </kbd>
        </button>
      )}
      {actions}
    </div>
  );
}
