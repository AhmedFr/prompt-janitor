import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { commands, isTauri } from "@/lib/ipc";
import type { Route } from "@/App/App.types";
import { PanelFixes } from "./PanelFixes";
import { PanelFooter } from "./PanelFooter";
import { PanelHeader } from "./PanelHeader";
import { PanelSignals } from "./PanelSignals";
import {
  FAILED_BODY,
  FAILED_RETRY,
  FAILED_TITLE,
  LOADING_LABEL,
} from "./Panel.constants";
import type { PanelProps } from "./Panel.types";
import { usePanel } from "./usePanel";
import "./Panel.css";

/**
 * The menu-bar popover: the whole "is my setup good enough?" answer in one
 * 360 × 480 card, without opening the app.
 *
 * Layout only — {@link usePanel} owns the snapshot, the scan and the window,
 * and every row hands its click to the main window through `open_main`,
 * because this window has no router of its own to navigate.
 */
export function Panel({ data: override, failed: failedOverride, scanning: scanningOverride }: PanelProps) {
  const state = usePanel();
  const data = override ?? state.data;
  // A story that supplies its own snapshot is never loading; the hook's flag
  // only describes the live fetch.
  const loading = state.loading && override === undefined;
  // The load finished and still produced nothing to show: the query failed.
  // An empty card would read as "your setup is empty", which is a different
  // — and false — thing to tell someone.
  const failed = failedOverride ?? (!loading && data == null);
  const scanning = scanningOverride ?? state.scanning;

  const openMain = (route: Route, target: string | null = null) => {
    // Outside the desktop runtime there is no other window to raise.
    if (!isTauri) return;
    // A bare invoke with no `typedError` wrapper: a rejection here is an
    // unhandled one, and a failed window raise is not worth a crash overlay.
    commands.openMain(route, target).catch(() => {});
  };

  return (
    <div className="panel">
      {loading ? (
        <PanelLoading />
      ) : failed || data == null ? (
        <PanelFailure onRetry={() => void state.refetch()} />
      ) : (
        <div className="panel__body">
          <PanelHeader snapshot={data} />
          {data.has_data && (
            <>
              <PanelFixes fixes={data.top_fixes} onOpen={(fileId) => openMain("detail", fileId)} />
              <PanelSignals
                neverUsedSkills={data.never_used_skills}
                mcpErroring={data.mcp_erroring}
                sessionsToday={data.sessions_today}
                onOpen={openMain}
              />
            </>
          )}
        </div>
      )}

      {!loading && (
        <PanelFooter
          scanning={scanning}
          scan={state.scan}
          onScan={() => void state.startScan()}
          onOpenApp={() => openMain("overview")}
          onQuit={() => {
            if (isTauri) commands.quit().catch(() => {});
          }}
        />
      )}
    </div>
  );
}

/** The shape of the answer before it arrives — the panel opens instantly, the query does not. */
function PanelLoading() {
  return (
    <div className="panel__body panel__loading" role="status" aria-label={LOADING_LABEL}>
      <div className="panel__skeleton panel__skeleton--ring" />
      <div className="panel__skeleton panel__skeleton--line" />
      <div className="panel__skeleton panel__skeleton--line panel__skeleton--short" />
    </div>
  );
}

/** The snapshot could not be read — say so, and offer the one retry there is. */
function PanelFailure({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="panel__body panel__failure">
      <h1 className="panel__failure-title">{FAILED_TITLE}</h1>
      <p className="muted panel__failure-body">{FAILED_BODY}</p>
      <Button size="sm" onClick={onRetry}>
        <Icon name="refresh" /> {FAILED_RETRY}
      </Button>
    </div>
  );
}
