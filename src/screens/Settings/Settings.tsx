import { useEffect, useState } from "react";
import { BackButton } from "@/components/BackButton";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { isTauri } from "@/lib/ipc";
import type { Navigate } from "@/App/App.types";
import type { RuleTabId } from "./ChecksTab/ChecksLibrary/ChecksLibrary.types";
import { useSettings } from "./useSettings";
import { FoldersTab } from "./FoldersTab";
import { ScanningTab } from "./ScanningTab";
import { NotificationsTab } from "./NotificationsTab";
import { ChecksTab } from "./ChecksTab";
import { AiTab } from "./AiTab";
import { AboutTab } from "./AboutTab";
import { SETTINGS_TABS, type SettingsTabId } from "./Settings.constants";
import { resolveSettingsTab } from "./settingsTab.util";
import "./Settings.css";

export interface SettingsProps {
  navigate: Navigate;
  /** Tab to open on (e.g. "ai" from the Overview coverage line, or a legacy id). */
  initialTab?: string;
  /** The rule table Settings → Checks opens on (from an old `rules` deep link). */
  checksTab?: RuleTabId;
}

export function Settings({ navigate: _navigate, initialTab, checksTab }: SettingsProps) {
  const s = useSettings();
  // Default to the first tab in the strip: a screen that opens on its second
  // tab reads as a lost selection rather than a starting point.
  const [tab, setTab] = useState<SettingsTabId>(() => resolveSettingsTab(initialTab));

  // Follow later in-app deep links (e.g. Overview → Settings → AI) even if
  // the screen happens to stay mounted.
  useEffect(() => {
    if (initialTab) setTab(resolveSettingsTab(initialTab));
  }, [initialTab]);

  return (
    <section className="screen">
      <header className="screen__toolbar" data-tauri-drag-region>
        <BackButton />
        <h1 className="screen__title">Settings</h1>
      </header>
      <div className="scroll-area">
        <div className="page" style={{ maxWidth: 720 }}>
          <div className="set-tabs">
            {SETTINGS_TABS.map(({ id, label, icon }) => (
              <button
                key={id}
                className={"set-tab" + (tab === id ? " set-tab--on" : "")}
                onClick={() => setTab(id)}
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
              {tab === "folders" && <FoldersTab />}

              {tab === "scanning" && (
                <ScanningTab schedule={s.schedule} onChange={(k) => void s.setSchedule(k)} />
              )}

              {tab === "notifications" && (
                <NotificationsTab
                  digest={s.digest}
                  regressions={s.regressions}
                  onDigest={(on) => void s.setDigest(on)}
                  onRegressions={(on) => void s.setRegressions(on)}
                />
              )}

              {tab === "checks" && <ChecksTab initialTab={checksTab} />}

              {tab === "ai" && <AiTab ai={s.ai} onSave={s.saveAi} onTest={s.testAi} />}

              {tab === "about" && <AboutTab status={s.status} />}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
