import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Grade, type GradeLetter } from "@/components/Grade";
import { Icon } from "@/components/Icon";
import { KindSections, Heading, type Level } from "../KindSections";
import { projectMatchCount, relativeSession, sessionLabel, topRuleGrade } from "../setup.util";
import { RuleLink } from "./RuleLink";
import type { EffectiveRules, ProjectRowProps } from "./ProjectRow.types";

/**
 * The project name is an `h3` inside the summary, so the body's blocks are
 * `h4` — one level down from the row that owns them, never skipping a level.
 */
const BODY_LEVEL: Level = 4;

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
  effectiveRulesFor,
  rulesVersion,
  navigate,
}: ProjectRowProps) {
  const [open, setOpen] = useState(false);
  // Bumped by the retry button; a failure is never memoised, so asking again
  // is a real second attempt.
  const [attempt, setAttempt] = useState(0);
  const [rules, setRules] = useState<EffectiveRules | null>(null);
  const { harness, path } = project;
  const grade = topRuleGrade(project);
  const matches = filter === "all" ? null : projectMatchCount(project, filter, costBar);

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
  }, [open, rulesVersion, attempt, effectiveRulesFor, harness, path]);

  return (
    <details className="setup-project" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="setup-project__summary">
        <h3 className="setup-project__name">{project.name}</h3>
        {/* The DB only writes A–F; the IPC type is a loose string. */}
        {grade && <Grade grade={grade as GradeLetter} size="sm" />}
        <span className="faint setup-project__meta">
          {sessionLabel(project.session_count)} · {relativeSession(project.last_session_at)}
        </span>
        {matches !== null && (
          <span className="setup-project__matches">
            {matches} match{matches === 1 ? "" : "es"}
          </span>
        )}
        {!project.exists && <span className="setup-project__missing">folder missing</span>}
        <span className="path setup-project__path">{path}</span>
      </summary>

      {open && (
        <div className="setup-project__body">
          <KindSections
            artifacts={project.artifacts}
            filter={filter}
            costBar={costBar}
            level={BODY_LEVEL}
            navigate={navigate}
          />
          <Heading level={BODY_LEVEL}>Effective rules</Heading>
          <RuleStack rules={rules} navigate={navigate} onRetry={() => setAttempt((n) => n + 1)} />
        </div>
      )}
    </details>
  );
}

/**
 * The rule stack, or an honest account of why it is missing. "The query failed"
 * and "no rule file applies here" are opposite facts, and showing the second
 * for the first tells the user their setup is empty when it may be full.
 */
function RuleStack({
  rules,
  navigate,
  onRetry,
}: {
  rules: EffectiveRules | null;
  navigate: ProjectRowProps["navigate"];
  onRetry: () => void;
}) {
  if (rules === null) return <p className="muted setup-kind__empty">Loading…</p>;

  if (rules === "error") {
    return (
      <div className="setup-rules__error">
        <p className="muted setup-kind__empty">Couldn&rsquo;t read the rule stack — try again</p>
        <Button size="sm" onClick={onRetry}>
          <Icon name="refresh" /> Try again
        </Button>
      </div>
    );
  }

  if (rules.length === 0) {
    return <p className="muted setup-kind__empty">No rule files apply to this project.</p>;
  }

  return (
    <Card>
      <ol className="setup-rules">
        {rules.map((rule) => (
          <li key={rule.path} className="setup-rules__item">
            <RuleLink rule={rule} navigate={navigate} />
          </li>
        ))}
      </ol>
    </Card>
  );
}
