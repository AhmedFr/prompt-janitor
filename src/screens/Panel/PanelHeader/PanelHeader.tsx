import { ScoreRing } from "@/components/ScoreRing";
import { NO_SCAN_HINT, NO_SCAN_TITLE } from "../Panel.constants";
import { deltaCopy, lastScanLine, verdictFor } from "../panel.util";
import { RING_SIZE } from "./PanelHeader.constants";
import type { PanelHeaderProps } from "./PanelHeader.types";
import "./PanelHeader.css";

/**
 * The ten-second answer: a grade ring, the verdict it means in words, which
 * way it moved, and how old the measurement is.
 *
 * Before the first scan there is no verdict to give — an ungraded setup shown
 * as a ring would read as a score, and "No data" painted like an A is a lie.
 */
export function PanelHeader({ snapshot, now }: PanelHeaderProps) {
  if (!snapshot.has_data) {
    return (
      <header className="panel-header panel-header--empty">
        <h1 className="panel-header__verdict">{NO_SCAN_TITLE}</h1>
        <p className="muted panel-header__hint">{NO_SCAN_HINT}</p>
      </header>
    );
  }

  return (
    <header className="panel-header">
      <ScoreRing score={snapshot.overall_score} grade={snapshot.overall_grade} size={RING_SIZE} />
      <div className="panel-header__text">
        <h1 className="panel-header__verdict">{verdictFor(snapshot.overall_grade)}</h1>
        <p className="panel-header__delta tnum">{deltaCopy(snapshot.delta)}</p>
        <p className="faint panel-header__scanned">{lastScanLine(snapshot.last_scan_at, now)}</p>
      </div>
    </header>
  );
}
