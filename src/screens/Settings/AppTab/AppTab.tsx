import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { ScanBar } from "@/components/ScanBar";
import { useAppTab } from "./useAppTab";
import { downloadStatus } from "./AppTab.util";
import { DANGER_NOTE, DOWNLOAD_BAR_LABEL, UP_TO_DATE } from "./AppTab.constants";
import type { AppTabBodyProps } from "./AppTab.types";
import "./AppTab.css";

/** Settings → App: which build is running, and how to move to a newer one. */
export function AppTab() {
  return <AppTabBody {...useAppTab()} />;
}

export function AppTabBody({
  version,
  update,
  check,
  install,
  danger,
  dangerResult,
  reset,
  uninstall,
}: AppTabBodyProps) {
  const busy =
    update.kind === "checking" || update.kind === "downloading" || update.kind === "restarting";

  return (
    <>
      <h2 className="set-sec">Version</h2>
      <Card>
        <div className="set-row">
          <span className="grow">Prompt Janitor</span>
          <span className="faint tnum">{version ?? "—"}</span>
        </div>
      </Card>

      <h2 className="set-sec" style={{ marginTop: 22 }}>
        Updates
      </h2>
      <Card padded>
        <p className="faint app-tab__note">
          Updates are downloaded from GitHub Releases and verified against a signing key baked into
          this build before anything is installed.
        </p>

        {update.kind === "downloading" && (
          <div className="app-tab__bar">
            <ScanBar
              progress={{ done: update.downloaded, total: update.total }}
              status={downloadStatus(update.downloaded, update.total)}
              label={DOWNLOAD_BAR_LABEL}
            />
          </div>
        )}

        {update.kind === "available" && (
          <div className="app-tab__found">
            <div className="app-tab__found-title">Version {update.version} is available</div>
            {update.notes && <p className="faint app-tab__notes">{update.notes}</p>}
          </div>
        )}

        <div className="row app-tab__actions">
          <Button size="sm" onClick={() => void check()} disabled={busy}>
            <Icon name="refresh" /> {update.kind === "checking" ? "Checking…" : "Check for updates"}
          </Button>
          {(update.kind === "available" ||
            update.kind === "downloading" ||
            update.kind === "restarting") && (
            <Button size="sm" variant="primary" onClick={() => void install()} disabled={busy}>
              <Icon name="arrowDown" />{" "}
              {update.kind === "restarting" ? "Relaunching…" : "Install & relaunch"}
            </Button>
          )}
          {update.kind === "current" && <span className="faint app-tab__line">{UP_TO_DATE}</span>}
          {update.kind === "error" && (
            <span className="app-tab__line app-tab__line--error" role="alert">
              {update.message}
            </span>
          )}
        </div>
      </Card>

      <h2 className="set-sec app-tab__danger-head">Danger zone</h2>
      <Card padded>
        <p className="faint app-tab__note">{DANGER_NOTE}</p>
        <div className="row app-tab__actions">
          <Button
            size="sm"
            className="app-tab__danger-btn"
            onClick={() => void reset()}
            disabled={danger !== ""}
          >
            <Icon name="refresh" /> {danger === "reset" ? "Resetting…" : "Reset app data…"}
          </Button>
          <Button
            size="sm"
            className="app-tab__danger-btn"
            onClick={() => void uninstall()}
            disabled={danger !== ""}
          >
            <Icon name="x" />{" "}
            {danger === "uninstall" ? "Uninstalling…" : "Uninstall Prompt Janitor…"}
          </Button>
        </div>
        {dangerResult && (
          <p
            className={"app-tab__danger-line" + (dangerResult.ok ? "" : " app-tab__line--error")}
            role={dangerResult.ok ? "status" : "alert"}
          >
            {dangerResult.message}
          </p>
        )}
      </Card>
    </>
  );
}
