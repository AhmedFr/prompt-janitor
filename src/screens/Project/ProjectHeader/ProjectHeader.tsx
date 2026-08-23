import { PathCell } from "@/components/DataTable";
import { Card } from "@/components/Card";
import { ProjectGlyph } from "@/components/ProjectGlyph";
import { ScoreRing } from "@/components/ScoreRing";
import { relativeSession } from "@/screens/Setup/setup.util";
import { HEADER_GLYPH_SIZE, HEADER_RING_SIZE } from "../Project.constants";
import type { FactProps, ProjectHeaderProps } from "./ProjectHeader.types";
import "./ProjectHeader.css";

/**
 * Everything true of the project itself, before any tab narrows it down: what
 * it is (glyph, name, path), how it is graded, and how recently anything
 * touched it. The three facts sit together because they are read together —
 * a low grade on a project nothing has opened in six months is a different
 * problem from the same grade on one worked in this morning.
 */
export function ProjectHeader({ project, lastScanAt }: ProjectHeaderProps) {
  return (
    <Card padded>
      <div className="project-head">
        <ProjectGlyph
          name={project.name}
          grade={project.grade}
          logo={project.logo}
          size={HEADER_GLYPH_SIZE}
        />
        <div className="project-head__id">
          <p className="project-head__name">{project.name}</p>
          <PathCell path={project.id} />
        </div>
        <dl className="project-head__facts">
          <Fact label="Sessions" value={String(project.session_count)} />
          <Fact label="Last session" value={relativeSession(project.last_session_at)} />
          <Fact label="Last scan" value={relativeSession(lastScanAt)} />
        </dl>
        <ScoreRing score={project.score} grade={project.grade} size={HEADER_RING_SIZE} />
      </div>
    </Card>
  );
}

/** One labelled number in the fact list. */
function Fact({ label, value }: FactProps) {
  return (
    <div className="project-fact">
      <dt className="project-fact__label">{label}</dt>
      <dd className="project-fact__value tnum">{value}</dd>
    </div>
  );
}
