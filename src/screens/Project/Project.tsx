import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { PathCell } from "@/components/DataTable";
import { ProjectGlyph } from "@/components/ProjectGlyph";
import { ScanBar } from "@/components/ScanBar";
import { ScoreRing } from "@/components/ScoreRing";
import { Tabs, useTabState, type TabItem } from "@/components/Tabs";
import type { ArtifactView, ProjectRow } from "@/lib/ipc";
import { rescan } from "@/lib/scan-actions";
import { scanStatusLine, useScanProgress } from "@/lib/useScanProgress";
import type { ColumnsCtx } from "@/screens/Setup/setup.columns";
import { relativeSession } from "@/screens/Setup/setup.util";
import {
  BACK_LABEL,
  FAILED_BODY,
  FAILED_RETRY,
  FAILED_TITLE,
  HEADER_GLYPH_SIZE,
  HEADER_RING_SIZE,
  MISSING_FOLDER_BODY,
  MISSING_FOLDER_TITLE,
  NO_SELECTION_BODY,
  NO_SELECTION_TITLE,
  NOT_FOUND_BODY,
  NOT_FOUND_TITLE,
  PROJECT_TABS,
  RESCAN_BUSY_LABEL,
  RESCAN_LABEL,
  TAB_IDS,
  TAB_STATE_KEY,
  TABS_LABEL,
} from "./Project.constants";
import type { ProjectData, ProjectProps } from "./Project.types";
import { useProject } from "./useProject";
import { EffectiveRulesTab } from "./tabs/EffectiveRulesTab";
import { RulesTab } from "./tabs/RulesTab";
import { SetupTab } from "./tabs/SetupTab";
import { UsageTab } from "./tabs/UsageTab";
import "./Project.css";

/**
 * Shared by every render with nothing configured yet, and frozen because of
 * it: a caller that pushed into it would populate all of them. Typed mutable
 * so it can stand in for a real row set (`DataTable` takes `Row[]`); the
 * freeze is what makes that safe rather than the type.
 */
const NO_ARTIFACTS = Object.freeze([] as ArtifactView[]) as ArtifactView[];

/**
 * One project, end to end: how it is graded, what rules load inside it, what
 * is configured there, and what the agent actually used. Layout only — every
 * derivation lives in `useProject`/`project.util`, and each tab is its own
 * component.
 */
export function Project({ path, navigate, data: override }: ProjectProps) {
  const state = useProject(path);
  const data = override ?? state.data;
  const loading = state.loading && !override;
  const project = data?.project ?? null;

  const [busy, setBusy] = useState(false);
  const scan = useScanProgress();

  // Stable across renders: `projectSetupColumns` caches on the identity of
  // the `ctx` these close over, and a fresh function every render defeats it.
  const openDetail = useCallback((fileId: string) => navigate("detail", fileId), [navigate]);
  const goBack = useCallback(() => navigate("projects"), [navigate]);

  const artifacts = data?.setup?.artifacts ?? NO_ARTIFACTS;
  // One entry, because every row in this table is in this one project — the
  // Setup builders resolve a row's project by longest path prefix, and this
  // is the only project they may resolve to here.
  const projectNames = useMemo(
    () => new Map(project ? [[project.id, project.name]] : []),
    [project],
  );
  const ctx = useMemo<ColumnsCtx>(
    () => ({ onOpen: openDetail, projectNames }),
    [openDetail, projectNames],
  );

  const tabs = useMemo<TabItem[]>(
    () => PROJECT_TABS.map((tab) => ({ ...tab, count: tabCount(tab.id, data, artifacts) })),
    [data, artifacts],
  );

  const [active, setActive] = useTabState(TAB_STATE_KEY, TAB_IDS[0], TAB_IDS);

  // A scan refreshes everything through the `scan-done` listener in
  // `useProject`, so nothing here has to refetch on its own.
  const runRescan = async () => {
    setBusy(true);
    scan.reset();
    try {
      await rescan();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="screen">
      <header className="screen__toolbar" data-tauri-drag-region>
        {/* The back arrow is the toolbar's only claim on `Back to Projects`;
            the panels below own that label whenever there is no project
            loaded to go back *from*. */}
        {project && (
          <button type="button" className="d-back" onClick={goBack} aria-label={BACK_LABEL}>
            <Icon name="chevronRight" size={14} />
          </button>
        )}
        <h1 className="screen__title">{project?.name ?? "Project"}</h1>
        <span className="toolbar-spacer" />
        {project && (
          <Button size="sm" disabled={busy} onClick={() => void runRescan()}>
            <Icon name="refresh" /> {busy ? RESCAN_BUSY_LABEL : RESCAN_LABEL}
          </Button>
        )}
      </header>

      <div className="scroll-area">
        <div className="page project-page">
          {busy && (
            <ScanBar
              progress={scan.progress}
              status={scanStatusLine(scan.phase, scan.progress, data?.harnessName ?? "agent")}
            />
          )}
          {path === undefined ? (
            <Panel title={NO_SELECTION_TITLE} body={NO_SELECTION_BODY} onBack={goBack} />
          ) : loading ? (
            <Card padded>
              <div className="muted">Loading…</div>
            </Card>
          ) : !data ? (
            <Panel
              title={FAILED_TITLE}
              body={FAILED_BODY}
              onBack={goBack}
              retry={{ label: FAILED_RETRY, onClick: () => void state.refetch() }}
            />
          ) : !project ? (
            <Panel title={NOT_FOUND_TITLE} body={NOT_FOUND_BODY} onBack={goBack} />
          ) : (
            <>
              <ProjectHeader project={project} lastScanAt={data.lastScanAt} />
              {!project.exists && <MissingFolder />}
              <Tabs items={tabs} active={active} onChange={setActive} ariaLabel={TABS_LABEL}>
                {(id) => <TabPanel id={id} data={data} artifacts={artifacts} ctx={ctx} onOpen={openDetail} />}
              </Tabs>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * The badge on a tab: how many rows it holds. `undefined` — not `0` — before
 * the data lands, so `Tabs` draws no badge rather than a zero the reader
 * would take for an answer.
 */
function tabCount(id: string, data: ProjectData | null, artifacts: ArtifactView[]): number | undefined {
  if (!data) return undefined;
  if (id === "effective") return data.effective.length;
  if (id === "setup") return artifacts.length;
  if (id === "usage") return data.usage?.ranked.length;
  return data.files.length;
}

/** Which tab's content the strip asked for. Only the active panel mounts. */
function TabPanel({
  id,
  data,
  artifacts,
  ctx,
  onOpen,
}: {
  id: string;
  data: ProjectData;
  artifacts: ArtifactView[];
  ctx: ColumnsCtx;
  onOpen: (fileId: string) => void;
}) {
  if (id === "effective") return <EffectiveRulesTab rules={data.effective} harness={data.harness} />;
  if (id === "setup") return <SetupTab artifacts={artifacts} ctx={ctx} />;
  if (id === "usage") return <UsageTab usage={data.usage} harness={data.harness} />;
  return <RulesTab files={data.files} onOpen={onOpen} />;
}

/** Everything true of the project itself, before any tab narrows it down. */
function ProjectHeader({ project, lastScanAt }: { project: ProjectRow; lastScanAt: string | null }) {
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

/** One labelled number in the header's fact list. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="project-fact">
      <dt className="project-fact__label">{label}</dt>
      <dd className="project-fact__value tnum">{value}</dd>
    </div>
  );
}

/** The harness remembers this project and the disk has lost it. */
function MissingFolder() {
  return (
    <Card padded>
      <div className="project-banner">
        <Icon name="folder" size={16} />
        <div>
          <p className="project-banner__title">{MISSING_FOLDER_TITLE}</p>
          <p className="muted project-banner__body">{MISSING_FOLDER_BODY}</p>
        </div>
      </div>
    </Card>
  );
}

/**
 * The three states that have no project to render: nothing selected, the read
 * failed, and nothing scanned matches the path. Each says which one it is —
 * an empty page would let all three read as "this project is empty" — and
 * each offers the way back, since the toolbar's arrow is not drawn without a
 * project.
 */
function Panel({
  title,
  body,
  onBack,
  retry,
}: {
  title: string;
  body: string;
  onBack: () => void;
  retry?: { label: string; onClick: () => void };
}) {
  return (
    <Card padded>
      <div className="project-panel">
        <h2 className="project-panel__title">{title}</h2>
        <p className="muted project-panel__body">{body}</p>
        <div className="project-panel__actions">
          {retry && (
            <Button onClick={retry.onClick}>
              <Icon name="refresh" /> {retry.label}
            </Button>
          )}
          <Button variant={retry ? undefined : "primary"} onClick={onBack}>
            {BACK_LABEL}
          </Button>
        </div>
      </div>
    </Card>
  );
}
