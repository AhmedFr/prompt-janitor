import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { isTauri, type HarnessInfo, type SetupView } from "@/lib/ipc";
import { addFolderAndScan, rescan } from "@/lib/scan-actions";
import type { Navigate } from "@/App/App.types";
import { KindSections, type Level } from "./KindSections";
import { ProjectRow } from "./ProjectRow";
import { FILTER_CHIPS } from "./Setup.constants";
import type { SetupProps, SetupState } from "./Setup.types";
import { costThreshold, harnessSummary, sortProjects } from "./setup.util";
import { useSetup } from "./useSetup";
import "./Setup.css";

/**
 * The whole Claude Code setup in one place: what applies everywhere, what each
 * project adds on top, and — annotated onto every piece — whether anything ever
 * actually used it.
 */
export function Setup({ navigate, data: override, initialFilter }: SetupProps) {
  const state = useSetup(initialFilter);
  const data = override ?? state.data;
  const loading = state.loading && !override;
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
          {loading ? (
            <Card padded>
              <div className="muted">
                {isTauri ? "Loading…" : "Open the Prompt Janitor desktop app to see your setup."}
              </div>
            </Card>
          ) : !data ? (
            <UnreadableSetup busy={busy} onRetry={() => void run(async () => {})} />
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

/** The query failed — say so rather than spinning, and offer the one retry there is. */
function UnreadableSetup({ busy, onRetry }: { busy: boolean; onRetry: () => void }) {
  return (
    <Card padded>
      <div className="setup-empty">
        <h2 className="setup-empty__title">Setup could not be read</h2>
        <p className="muted setup-empty__body">
          The inventory query failed. This is usually a scan still holding the database — try again
          in a moment.
        </p>
        <Button disabled={busy} onClick={onRetry}>
          <Icon name="refresh" /> Try again
        </Button>
      </div>
    </Card>
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
  const { filter, setFilter, effectiveRulesFor, rulesVersion } = state;
  // One harness is the common case, and a header repeating its name every time
  // would be noise. Two or more, and the split is the whole point.
  const grouped = detected.length > 1;
  const level: Level = grouped ? 4 : 3;
  const projects = useMemo(() => sortProjects(data.projects), [data.projects]);
  // One bar for the whole setup: a per-section median would call half of any
  // list expensive, however cheap the list actually is.
  const costBar = useMemo(
    () => costThreshold([...data.global, ...data.projects.flatMap((p) => p.artifacts)]),
    [data],
  );

  const projectRow = (project: SetupView["projects"][number]) => (
    <ProjectRow
      key={`${project.harness} ${project.path}`}
      project={project}
      filter={filter}
      costBar={costBar}
      level={level}
      effectiveRulesFor={effectiveRulesFor}
      rulesVersion={rulesVersion}
      navigate={navigate}
    />
  );

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
            onClick={() => setFilter(chip.id)}
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
                costBar={costBar}
                level={level}
                navigate={navigate}
              />
            </div>
          ))
        ) : (
          <KindSections
            artifacts={data.global}
            filter={filter}
            costBar={costBar}
            level={level}
            navigate={navigate}
          />
        )}
      </section>

      <section className="setup-section" aria-labelledby="setup-projects">
        <h2 id="setup-projects" className="setup-section__title">
          Projects
        </h2>
        {grouped
          ? detected.map((h) => (
              <div key={h.id}>
                <h3 className="setup-harness__title">{h.display_name}</h3>
                {projects.filter((p) => p.harness === h.id).map(projectRow)}
              </div>
            ))
          : projects.map(projectRow)}
        {projects.length === 0 && <p className="muted">No projects seen yet.</p>}
      </section>
    </>
  );
}
