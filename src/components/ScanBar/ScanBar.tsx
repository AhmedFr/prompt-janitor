import { Card } from "@/components/Card";
import { scanPercent } from "@/lib/useScanProgress";
import { SCAN_BAR_LABEL } from "./ScanBar.constants";
import type { ScanBarProps } from "./ScanBar.types";
import "./ScanBar.css";

/**
 * How a running scan looks, wherever one can be started — onboarding, Setup's
 * Rescan, a project page's Rescan. A rescan that only greys out a button
 * leaves a long scan indistinguishable from a hang, and three screens each
 * drawing their own bar would drift apart, so there is exactly one.
 *
 * Dumb on purpose: the caller owns {@link useScanProgress} and hands the
 * numbers down, so the bar has nothing to subscribe to and nothing to reset.
 */
export function ScanBar({ progress, status }: ScanBarProps) {
  const percent = scanPercent(progress);
  // A scan with no counter yet is genuinely indeterminate: the bar draws a
  // stub so it reads as "running", but claiming 8% done would be a number we
  // do not have.
  const measured = progress != null && progress.total > 0;

  return (
    <Card padded>
      <div className="scan-bar">
        <div
          className="bar scan-bar__track"
          role="progressbar"
          aria-label={SCAN_BAR_LABEL}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={measured ? Math.round(percent) : undefined}
          aria-valuetext={measured ? undefined : status}
        >
          <i className="scan-bar__fill" style={{ width: `${percent}%` }} />
        </div>
        <div className="faint tnum scan-bar__status">{status}</div>
      </div>
    </Card>
  );
}
