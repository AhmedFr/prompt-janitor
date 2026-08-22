import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import type { HarnessInfo } from "@/lib/ipc";
import { scanPercent, scanStatusLine } from "@/lib/useScanProgress";
import { harnessSummary } from "@/screens/Setup/setup.util";
import { useHarnessTab } from "./useHarnessTab";
import type { HarnessTabBodyProps } from "./HarnessTab.types";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * "last scanned Xm/Xh/Xd ago" for a harness row. `relativeSession` in
 * setup.util covers session ages, but its coarsest-under-an-hour bucket
 * ("just now") is too blunt for a scan that just finished a few minutes ago.
 */
function lastScanned(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const ms = Math.max(0, now.getTime() - then);
  if (ms < MINUTE_MS) return "just now";
  if (ms < HOUR_MS) return `${Math.floor(ms / MINUTE_MS)}m ago`;
  if (ms < DAY_MS) return `${Math.floor(ms / HOUR_MS)}h ago`;
  return `${Math.floor(ms / DAY_MS)}d ago`;
}

/** The one-line row label: reuses `harnessSummary`'s counts, not a second formatter. */
function harnessLabel(h: HarnessInfo): string {
  if (!h.detected) return `${h.display_name} — not detected`;
  return harnessSummary(h).replace(`${h.display_name} · `, `${h.display_name} — detected · `);
}

/** Settings → Harnesses: what's registered, and the extra folders scanned alongside them. */
export function HarnessTab() {
  const { loading, ...body } = useHarnessTab();

  if (loading) {
    return (
      <Card padded>
        <div className="muted">Loading…</div>
      </Card>
    );
  }

  return <HarnessTabBody {...body} />;
}

export function HarnessTabBody({
  harnesses,
  extraFolders,
  scanning,
  scanProgress,
  addFolder,
  removeFolder,
  rescan,
}: HarnessTabBodyProps) {
  const active = harnesses.find((h) => h.detected)?.display_name ?? "agent";

  return (
    <>
      <h2 className="set-sec">Harnesses</h2>
      {scanning && (
        <Card padded>
          <div className="set-scan">
            <div className="bar" style={{ width: "100%" }}>
              <i style={{ width: `${scanPercent(scanProgress.progress)}%`, transition: "width .15s" }} />
            </div>
            <div className="faint tnum set-scan__status">
              {scanStatusLine(scanProgress.phase, scanProgress.progress, active)}
            </div>
          </div>
        </Card>
      )}
      <Card>
        {harnesses.length === 0 ? (
          <div className="set-row">
            <span className="muted grow">No harnesses registered.</span>
          </div>
        ) : (
          harnesses.map((h) => {
            const scanned = h.detected ? lastScanned(h.last_scan_at) : null;
            return (
              <div className="set-row" key={h.id}>
                <span
                  style={{ display: "flex", color: h.detected ? "var(--blue)" : "var(--text-3)" }}
                >
                  <Icon name="layers" size={18} />
                </span>
                <div className="grow">
                  <div>{harnessLabel(h)}</div>
                  {scanned && (
                    <div className="faint" style={{ fontSize: 12 }}>
                      last scanned {scanned}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </Card>
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <Button size="sm" disabled={scanning} onClick={() => void rescan()}>
          <Icon name="refresh" /> {scanning ? "Scanning…" : "Rescan now"}
        </Button>
      </div>

      <h2 className="set-sec" style={{ marginTop: 22 }}>
        Extra folders
      </h2>
      <Card>
        {extraFolders.length === 0 ? (
          <div className="set-row">
            <span className="muted grow">
              No extra folders — every detected agent harness is scanned already.
            </span>
          </div>
        ) : (
          extraFolders.map((f) => (
            <div className="set-row" key={f}>
              <span style={{ display: "flex", color: "var(--blue)" }}>
                <Icon name="folder" size={18} />
              </span>
              <span className="path grow">{f}</span>
              <Button size="sm" disabled={scanning} onClick={() => void removeFolder(f)}>
                Remove
              </Button>
            </div>
          ))
        )}
      </Card>
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <Button size="sm" disabled={scanning} onClick={() => void addFolder()}>
          <Icon name="folder" /> Add folder…
        </Button>
      </div>
      <p className="faint" style={{ fontSize: 12, marginTop: 12, maxWidth: 560 }}>
        Prompt Janitor skips <code>node_modules</code>/<code>vendor</code> and respects{" "}
        <code>.gitignore</code>.
      </p>
    </>
  );
}
