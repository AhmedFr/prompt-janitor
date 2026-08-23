import { ScoreRing } from "@/components/ScoreRing";
import { NO_SCAN_HINT, NO_SCAN_TITLE } from "../Panel.constants";
import { deltaCopy, metaLine, verdictFor } from "../panel.util";
import { RING_SIZE } from "./PanelHeader.constants";
import type { PanelHeaderProps } from "./PanelHeader.types";
import "./PanelHeader.css";

/**
 * The ten-second answer: a grade ring, the verdict it means in words, which
 * way it moved, and one muted meta line carrying the score and the age of the
 * measurement. The score sits there rather than inside the ring: at 56 px the
 * ring has no room for a second line of type, and a letter without its number
 * cannot tell a bare pass from a near miss.
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
        <p className="faint panel-header__meta tnum">
          {metaLine(snapshot.overall_score, snapshot.last_scan_at, now)}
        </p>
      </div>
    </header>
  );
}
