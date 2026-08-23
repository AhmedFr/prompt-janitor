import { useMemo } from "react";
import { GradeCell, PathCell } from "@/components/DataTable";
import type { GradeLetter } from "@/components/Grade";
import { EFFECTIVE_EMPTY, EFFECTIVE_TITLE, LAYER_LABEL, NO_HARNESS_NOTE } from "../Project.constants";
import { orderEffectiveRules } from "../project.util";
import type { EffectiveRulesTabProps } from "./tabs.types";

/**
 * The rule stack this project loads, outermost layer first — a list rather
 * than a table because the order *is* the content: what the harness reads
 * first, and what overrides it. Ungraded entries keep their place; a file the
 * grader has not seen still shapes every session run here.
 */
export function EffectiveRulesTab({ rules, harness }: EffectiveRulesTabProps) {
  const ordered = useMemo(() => orderEffectiveRules(rules), [rules]);

  if (!harness) return <p className="muted project-note">{NO_HARNESS_NOTE}</p>;
  if (ordered.length === 0) return <p className="muted project-note">{EFFECTIVE_EMPTY}</p>;

  return (
    <ol className="project-stack" aria-label={EFFECTIVE_TITLE}>
      {ordered.map((rule, index) => (
        <li key={`${rule.layer}:${rule.path}`} className="project-stack__item">
          {/* The position is already the list item's own number to assistive
              tech; drawn here only so the eye can follow the order. */}
          <span className="project-stack__step tnum" aria-hidden="true">
            {index + 1}
          </span>
          <span className="project-stack__layer" data-layer={rule.layer}>
            {LAYER_LABEL[rule.layer]}
          </span>
          <span className="project-stack__name">{rule.name}</span>
          <PathCell path={rule.path} />
          {/* The DB only ever writes A-F; the IPC type is a looser string. */}
          <GradeCell grade={rule.grade as GradeLetter | null} />
        </li>
      ))}
    </ol>
  );
}
