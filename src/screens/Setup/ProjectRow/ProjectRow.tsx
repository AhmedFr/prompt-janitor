import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { Grade, type GradeLetter } from "@/components/Grade";
import type { EffectiveRule } from "@/lib/ipc";
import { KindSections, Heading } from "../KindSections";
import { relativeSession, sessionLabel, topRuleGrade } from "../setup.util";
import { RuleLink } from "./RuleLink";
import type { ProjectRowProps } from "./ProjectRow.types";

/**
 * One project, collapsed. Expanding is what pays for the per-project rule-stack
 * query and for mounting its artifact cards, so both wait for the first open —
 * a machine with thirty projects would otherwise mount hundreds of rows nobody
 * asked to see. A rescan invalidates the stack, which `rulesVersion` reports.
 */
export function ProjectRow({
  project,
  filter,
  costBar,
  level,
  effectiveRulesFor,
  rulesVersion,
  navigate,
}: ProjectRowProps) {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<EffectiveRule[] | null>(null);
  const { harness, path } = project;
  const grade = topRuleGrade(project);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setRules(null);
    void effectiveRulesFor(harness, path).then((loaded) => {
      if (live) setRules(loaded);
    });
    return () => {
      live = false;
    };
  }, [open, rulesVersion, effectiveRulesFor, harness, path]);

  return (
    <details className="setup-project" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="setup-project__summary">
        <span className="setup-project__name">{project.name}</span>
        {/* The DB only writes A–F; the IPC type is a loose string. */}
        {grade && <Grade grade={grade as GradeLetter} size="sm" />}
        <span className="faint setup-project__meta">
          {sessionLabel(project.session_count)} · {relativeSession(project.last_session_at)}
        </span>
        {!project.exists && <span className="setup-project__missing">folder missing</span>}
        <span className="path setup-project__path">{path}</span>
      </summary>

      {open && (
        <div className="setup-project__body">
          <KindSections
            artifacts={project.artifacts}
            filter={filter}
            costBar={costBar}
            level={level}
            navigate={navigate}
          />
          <Heading level={level}>Effective rules</Heading>
          {rules === null ? (
            <p className="muted setup-kind__empty">Loading…</p>
          ) : rules.length === 0 ? (
            <p className="muted setup-kind__empty">No rule files apply to this project.</p>
          ) : (
            <Card>
              <ol className="setup-rules">
                {rules.map((rule) => (
                  <li key={rule.path} className="setup-rules__item">
                    <RuleLink rule={rule} navigate={navigate} />
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      )}
    </details>
  );
}
