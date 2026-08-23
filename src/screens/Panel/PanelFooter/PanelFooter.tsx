import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { ScanBar } from "@/components/ScanBar";
import { scanStatusLine } from "@/lib/useScanProgress";
import { SCAN_HARNESS } from "../Panel.constants";
import { OPEN_APP, QUIT, SCAN_NOW, SCANNING } from "./PanelFooter.constants";
import type { PanelFooterProps } from "./PanelFooter.types";
import "./PanelFooter.css";

/**
 * The three things the panel can do: measure again, hand over to the app, or
 * quit. A running scan narrates itself here rather than only greying the
 * button out — a long scan and a hang look identical otherwise.
 */
export function PanelFooter({ scanning, scan, onScan, onOpenApp, onQuit }: PanelFooterProps) {
  return (
    <footer className="panel-footer">
      {scanning && (
        <div className="panel-footer__scan">
          <ScanBar
            progress={scan.progress}
            status={scanStatusLine(scan.phase, scan.progress, SCAN_HARNESS)}
          />
        </div>
      )}
      <div className="panel-footer__actions">
        <Button size="sm" variant="primary" disabled={scanning} onClick={onScan}>
          <Icon name="refresh" /> {scanning ? SCANNING : SCAN_NOW}
        </Button>
        <span className="toolbar-spacer" />
        <Button size="sm" onClick={onOpenApp}>
          {OPEN_APP}
        </Button>
        <Button size="sm" onClick={onQuit}>
          {QUIT}
        </Button>
      </div>
    </footer>
  );
}
