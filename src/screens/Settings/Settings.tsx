import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Icon, type IconName } from "@/components/Icon";
import { commands, isTauri } from "@/lib/ipc";
import { pickAndScan, rescan } from "@/lib/scan-actions";
import type { Navigate } from "@/App/App.types";
import { useSettings } from "./useSettings";
import "./Settings.css";

type Tab = "folders" | "schedule" | "alerts" | "rules" | "general";

const TABS: [Tab, string, IconName][] = [
  ["folders", "Folders", "folder"],
  ["schedule", "Schedule", "clock"],
  ["alerts", "Alerts", "bell"],
  ["rules", "Rules", "rules"],
  ["general", "General", "settings"],
];

const FREQS: [string, string, string][] = [
  ["1h", "Hourly", "Most up-to-date · uses more CPU"],
  ["6h", "Every 6 hours", "Recommended balance"],
  ["1d", "Once a day", "Light touch"],
  ["save", "On file save", "Watch mode · instant"],
  ["manual", "Manual only", "Scan when you click"],
];

export interface SettingsProps {
  navigate: Navigate;
}

export function Settings({ navigate }: SettingsProps) {
  const s = useSettings();
  const [tab, setTab] = useState<Tab>("schedule");

  const changeFolder = async () => {
    const ok = await pickAndScan();
    if (ok) {
      const res = await commands.getScanFolder();
      if (res.status === "ok") s.setFolder(res.data);
    }
  };

  return (
    <section className="screen">
      <header className="screen__toolbar" data-tauri-drag-region>
        <h1 className="screen__title">Settings</h1>
      </header>
      <div className="scroll-area">
        <div className="page" style={{ maxWidth: 720 }}>
          <div className="set-tabs">
            {TABS.map(([key, label, icon]) => (
              <button
                key={key}
                className={"set-tab" + (tab === key ? " set-tab--on" : "")}
                onClick={() => setTab(key)}
              >
                <span className="set-tab-ico">
                  <Icon name={icon} size={18} />
                </span>
                {label}
              </button>
            ))}
          </div>

          {!isTauri ? (
            <Card padded>
              <div className="muted">Open the desktop app to change settings.</div>
            </Card>
          ) : s.loading ? (
            <Card padded>
              <div className="muted">Loading…</div>
            </Card>
          ) : (
            <>
              {tab === "folders" && (
                <>
                  <h2 className="set-sec">Scan folder</h2>
                  <Card>
                    <div className="set-row">
                      <span style={{ display: "flex", color: "var(--blue)" }}>
                        <Icon name="folder" size={18} />
                      </span>
                      <span className="path grow">{s.folder ?? "No folder selected yet"}</span>
                    </div>
                  </Card>
                  <div className="row" style={{ gap: 8, marginTop: 10 }}>
                    <Button size="sm" onClick={() => void changeFolder()}>
                      <Icon name="folder" /> Change folder…
                    </Button>
                    {s.folder && (
                      <Button size="sm" onClick={() => void rescan(s.folder!)}>
                        <Icon name="refresh" /> Rescan now
                      </Button>
                    )}
                  </div>
                  <p className="faint" style={{ fontSize: 12, marginTop: 12, maxWidth: 560 }}>
                    Prompt Janitor skips <code>node_modules</code>/<code>vendor</code> and respects{" "}
                    <code>.gitignore</code>.
                  </p>
                </>
              )}

              {tab === "schedule" && (
                <>
                  <h2 className="set-sec">Scan frequency</h2>
                  <Card>
                    {FREQS.map(([key, label, desc]) => (
                      <button
                        key={key}
                        className="set-row set-row--btn"
                        onClick={() => void s.setSchedule(key)}
                      >
                        <span className={"set-radio" + (s.schedule === key ? " set-radio--on" : "")}>
                          {s.schedule === key && <span className="set-radio-dot" />}
                        </span>
                        <div className="grow">
                          <div style={{ fontWeight: 500 }}>{label}</div>
                          <div className="faint" style={{ fontSize: 12 }}>
                            {desc}
                          </div>
                        </div>
                      </button>
                    ))}
                  </Card>
                </>
              )}

              {tab === "alerts" && (
                <>
                  <h2 className="set-sec">Notifications</h2>
                  <Card>
                    <AlertRow
                      label="Weekly digest"
                      detail="A summary of the week's changes"
                      on={s.digest}
                      onToggle={() => void s.setDigest(!s.digest)}
                    />
                    <AlertRow
                      label="Alert when a file regresses a grade"
                      detail="Notify when a grade drops"
                      on={s.regressions}
                      onToggle={() => void s.setRegressions(!s.regressions)}
                    />
                  </Card>
                  <p className="faint" style={{ fontSize: 12, marginTop: 12, maxWidth: 560 }}>
                    A calm cadence — periodic summaries with regression alerts, no constant pinging.
                  </p>
                </>
              )}

              {tab === "rules" && (
                <Card padded>
                  <div className="muted" style={{ marginBottom: 12 }}>
                    Manage the rule library — built-in packs and your custom rules — on the Rules tab.
                  </div>
                  <Button size="sm" onClick={() => navigate("rules")}>
                    <Icon name="rules" /> Open Rules →
                  </Button>
                </Card>
              )}

              {tab === "general" && (
                <>
                  <h2 className="set-sec">About</h2>
                  <Card>
                    <div className="set-row">
                      <span className="grow">Version</span>
                      <span className="faint tnum">0.1.0</span>
                    </div>
                    <div className="set-row">
                      <span className="grow">Files tracked</span>
                      <span className="faint tnum">{s.status?.file_count ?? "—"}</span>
                    </div>
                    <div className="set-row">
                      <span className="grow">Storage</span>
                      <span
                        className="path faint"
                        style={{
                          maxWidth: 320,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.status?.db_path ?? "—"}
                      </span>
                    </div>
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function AlertRow({
  label,
  detail,
  on,
  onToggle,
}: {
  label: string;
  detail: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="set-row">
      <div className="grow">
        <div style={{ fontWeight: 500 }}>{label}</div>
        <div className="faint" style={{ fontSize: 12 }}>
          {detail}
        </div>
      </div>
      <button
        className={"switch" + (on ? " on" : "")}
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onToggle}
      />
    </div>
  );
}
