import { Button } from "@/components/Button";
import { Sparkline } from "@/components/Sparkline";
import { LENS_WINDOW_DAYS } from "../useLens";
import { relativeSession } from "../setup.util";
import { MissingFolderBanner } from "./MissingFolderBanner";
import { NO_SESSIONS, REVEAL_LABEL, SPARKLINE_HEIGHT, SPARKLINE_WIDTH } from "./ProjectStrip.constants";
import type { ProjectStripProps } from "./ProjectStrip.types";
import "./ProjectStrip.css";

/** The project the lens looks through: its name, how busy it has been, and the way to its folder. */
export function ProjectStrip({ project, sessionsPerDay, onReveal }: ProjectStripProps) {
  return (
    <div className="project-strip">
      <strong className="project-strip__name">{project.name}</strong>
      {!project.exists ? (
        <MissingFolderBanner />
      ) : (
        <>
          {sessionsPerDay ? (
            <>
              <span className="muted">
                {sessionsPerDay.reduce((sum, d) => sum + d.count, 0)} sessions · {LENS_WINDOW_DAYS} days
              </span>
              <Sparkline data={sessionsPerDay.map((d) => d.count)} width={SPARKLINE_WIDTH} height={SPARKLINE_HEIGHT} />
            </>
          ) : (
            <span className="muted">{NO_SESSIONS}</span>
          )}
          <span className="muted">last session {relativeSession(project.last_session_at)}</span>
          <span className="project-strip__spacer" />
          <Button size="sm" onClick={onReveal}>
            {REVEAL_LABEL}
          </Button>
        </>
      )}
    </div>
  );
}
