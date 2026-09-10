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
      {/* Default size, not `sm`: these are the popover's only controls and a
          12 px pill under a 13 px card reads as a secondary toolbar. The three
          of them measure ~278 px inside a 324 px row, so they still fit. */}
      <div className="panel-footer__actions">
        <Button variant="primary" disabled={scanning} onClick={onScan}>
          <Icon name="refresh" /> {scanning ? SCANNING : SCAN_NOW}
        </Button>
        <span className="toolbar-spacer" />
        <Button onClick={onOpenApp}>{OPEN_APP}</Button>
        <Button onClick={onQuit}>{QUIT}</Button>
      </div>
    </footer>
  );
}
