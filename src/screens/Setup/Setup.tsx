import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArtifactCard, KIND_LABEL } from "@/components/ArtifactCard";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Grade, type GradeLetter } from "@/components/Grade";
import { Icon } from "@/components/Icon";
import {
  isTauri,
  type ArtifactView,
  type EffectiveRule,
  type HarnessInfo,
  type ProjectSetup,
  type SetupView,
} from "@/lib/ipc";
import { addFolderAndScan, rescan } from "@/lib/scan-actions";
import type { Navigate } from "@/App/App.types";
import { FILTER_CHIPS } from "./Setup.constants";
import type { SetupProps, SetupState } from "./Setup.types";
import {
  applyFilter,
  groupByKind,
  harnessSummary,
  relativeSession,
  sessionLabel,
  sortProjects,
  type SetupFilter,
} from "./setup.util";
import { useSetup } from "./useSetup";
import "./Setup.css";

/** Heading depth for a section nested under Global/Projects (h2). */
type Level = 3 | 4;

/**
 * The whole Claude Code setup in one place: what applies everywhere, what each
 * project adds on top, and — annotated onto every piece — whether anything ever
 * actually used it.
 */
export function Setup({ navigate, data: override, initialFilter }: SetupProps) {
  const state = useSetup(initialFilter);
  const data = override ?? state.data;
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await state.refetch();
    } finally {
      setBusy(false);
    }
  };

  const detected = data?.harnesses.filter((h) => h.detected) ?? [];

  return (
    <section className="screen">
      <header className="screen__toolbar" data-tauri-drag-region>
        <h1 className="screen__title">Setup</h1>
        <span className="toolbar-spacer" />
        {detected.length > 0 && (
          <Button size="sm" disabled={busy} onClick={() => void run(rescan)}>
            <Icon name="refresh" /> {busy ? "Scanning…" : "Rescan"}
          </Button>
        )}
      </header>

      <div className="scroll-area">
        <div className="page" style={{ maxWidth: 1000 }}>
          {!data ? (
            <Card padded>
              <div className="muted">
                {isTauri ? "Loading…" : "Open the Prompt Janitor desktop app to see your setup."}
              </div>
            </Card>
          ) : detected.length === 0 ? (
            <NoHarness busy={busy} onAddFolder={() => void run(addFolderAndScan)} />
          ) : (
            <Inventory data={data} detected={detected} state={state} navigate={navigate} />
          )}
        </div>
      </div>
    </section>
  );
}

/** Nothing to inventory — the one thing left to do is point us at a folder. */
function NoHarness({ busy, onAddFolder }: { busy: boolean; onAddFolder: () => void }) {
  return (
    <Card padded>
      <div className="setup-empty">
        <h2 className="setup-empty__title">No supported agent harness found</h2>
        <p className="muted setup-empty__body">
          Prompt Janitor reads the setup Claude Code already keeps on disk. Nothing was detected
          here, so point it at a folder and it will grade the prompt files inside.
        </p>
        <Button variant="primary" disabled={busy} onClick={onAddFolder}>
          <Icon name="folder" /> Add a folder
        </Button>
      </div>
    </Card>
  );
}

function Inventory({
  data,
  detected,
  state,
  navigate,
}: {
  data: SetupView;
  detected: HarnessInfo[];
  state: SetupState;
  navigate: Navigate;
}) {
  const filter = state.filter;
  // One harness is the common case, and a header repeating its name every time
  // would be noise. Two or more, and the split is the whole point.
  const grouped = detected.length > 1;
  const level: Level = grouped ? 4 : 3;
  const projects = useMemo(() => sortProjects(data.projects), [data.projects]);

  return (
    <>
      <p className="setup-harnesses">
        {detected.map((h) => (
          <span key={h.id} className="setup-harness">
            {harnessSummary(h)}
          </span>
        ))}
      </p>

      <div className="setup-filters" role="group" aria-label="Filter setup">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={"setup-chip" + (filter === chip.id ? " setup-chip--on" : "")}
            aria-pressed={filter === chip.id}
            onClick={() => state.setFilter(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <section className="setup-section" aria-labelledby="setup-global">
        <h2 id="setup-global" className="setup-section__title">
          Global
        </h2>
        {grouped ? (
          detected.map((h) => (
            <div key={h.id}>
              <h3 className="setup-harness__title">{h.display_name}</h3>
              <KindSections
                artifacts={data.global.filter((a) => a.harness === h.id)}
                filter={filter}
                level={level}
                navigate={navigate}
              />
            </div>
          ))
        ) : (
          <KindSections
            artifacts={data.global}
            filter={filter}
            level={level}
            navigate={navigate}
          />
        )}
      </section>

      <section className="setup-section" aria-labelledby="setup-projects">
        <h2 id="setup-projects" className="setup-section__title">
          Projects
        </h2>
        {grouped ? (
          detected.map((h) => (
            <div key={h.id}>
              <h3 className="setup-harness__title">{h.display_name}</h3>
              {projects
                .filter((p) => p.harness === h.id)
                .map((p) => (
                  <ProjectRow
                    key={`${p.harness} ${p.path}`}
                    project={p}
                    filter={filter}
                    level={level}
                    state={state}
                    navigate={navigate}
                  />
                ))}
            </div>
          ))
        ) : (
          projects.map((p) => (
            <ProjectRow
              key={`${p.harness} ${p.path}`}
              project={p}
              filter={filter}
              level={level}
              state={state}
              navigate={navigate}
            />
          ))
        )}
        {projects.length === 0 && <p className="muted">No projects seen yet.</p>}
      </section>
    </>
  );
}

/** A heading at the depth its surrounding section sits at. */
function Heading({ level, children }: { level: Level; children: ReactNode }) {
  const className = "setup-kind__title";
  return level === 3 ? (
    <h3 className={className}>{children}</h3>
  ) : (
    <h4 className={className}>{children}</h4>
  );
}

const kindHeading = (label: string) => (label.endsWith("s") ? label : `${label}s`);

/** The filtered artifacts, one titled block per kind. */
function KindSections({
  artifacts,
  filter,
  level,
  navigate,
}: {
  artifacts: ArtifactView[];
  filter: SetupFilter;
  level: Level;
  navigate: Navigate;
}) {
  const groups = useMemo(() => groupByKind(applyFilter(artifacts, filter)), [artifacts, filter]);

  if (groups.length === 0) {
    return <p className="muted setup-kind__empty">Nothing matches this filter.</p>;
  }

  return (
    <>
      {groups.map(({ kind, items }) => (
        <div key={kind} className="setup-kind">
          <Heading level={level}>
            {kindHeading(KIND_LABEL[kind])} <span className="faint">{items.length}</span>
          </Heading>
          <Card>
            <div className="setup-kind__list">
              {items.map((artifact) => (
                <ArtifactCard
                  key={artifact.id}
                  artifact={artifact}
                  onOpen={(fileId) => navigate("detail", fileId)}
                />
              ))}
            </div>
          </Card>
        </div>
      ))}
    </>
  );
}

/** First graded rule in the project — the closest thing to "how is this set up?". */
function topRuleGrade(project: ProjectSetup): string | null {
  return project.artifacts.find((a) => a.kind === "rule" && a.grade)?.grade ?? null;
}

/**
 * One project, collapsed. Expanding is what pays for the per-project rule-stack
 * query, so the body loads on first open and is kept afterwards.
 */
function ProjectRow({
  project,
  filter,
  level,
  state,
  navigate,
}: {
  project: ProjectSetup;
  filter: SetupFilter;
  level: Level;
  state: SetupState;
  navigate: Navigate;
}) {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<EffectiveRule[] | null>(null);
  const grade = topRuleGrade(project);

  useEffect(() => {
    if (!open || rules) return;
    let live = true;
    void state.effectiveRulesFor(project.harness, project.path).then((loaded) => {
      if (live) setRules(loaded);
    });
    return () => {
      live = false;
    };
  }, [open, rules, state, project.harness, project.path]);

  return (
    <details
      className="setup-project"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="setup-project__summary">
        <span className="setup-project__name">{project.name}</span>
        {grade && <Grade grade={grade as GradeLetter} size="sm" />}
        <span className="faint setup-project__meta">
          {sessionLabel(project.session_count)} · {relativeSession(project.last_session_at)}
        </span>
        {!project.exists && <span className="setup-project__missing">folder missing</span>}
        <span className="path setup-project__path">{project.path}</span>
      </summary>

      <div className="setup-project__body">
        <KindSections
          artifacts={project.artifacts}
          filter={filter}
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
    </details>
  );
}

const LAYER_LABEL: Record<EffectiveRule["layer"], string> = {
  global: "Global",
  project: "Project",
  plugin: "Plugin",
};

/** One rung of the rule stack; clickable when the grader has a file for it. */
function RuleLink({ rule, navigate }: { rule: EffectiveRule; navigate: Navigate }) {
  const body = (
    <>
      <span className="setup-rules__layer">{LAYER_LABEL[rule.layer]}</span>
      <span className="setup-rules__name">{rule.name}</span>
      <span className="path setup-rules__path">{rule.path}</span>
      <Grade grade={rule.grade as GradeLetter | null} size="sm" />
    </>
  );

  if (!rule.file_id) return <span className="setup-rules__row">{body}</span>;
  const fileId = rule.file_id;
  return (
    <button
      type="button"
      className="setup-rules__row setup-rules__row--link"
      onClick={() => navigate("detail", fileId)}
    >
      {body}
    </button>
  );
}
