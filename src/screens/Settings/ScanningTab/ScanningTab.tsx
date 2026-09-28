import { Card } from "@/components/Card";
import { SCAN_FREQUENCIES } from "./ScanningTab.constants";
import type { ScanningTabProps } from "./ScanningTab.types";

/** Settings → Scanning: how often folders are rescanned. */
export function ScanningTab({ schedule, onChange }: ScanningTabProps) {
  return (
    <>
      <h2 className="set-sec">Scan frequency</h2>
      <Card>
        {SCAN_FREQUENCIES.map((f) => (
          <button
            key={f.key}
            className="set-row set-row--btn"
            role="radio"
            aria-checked={schedule === f.key}
            aria-label={f.label}
            onClick={() => onChange(f.key)}
          >
            <span className={"set-radio" + (schedule === f.key ? " set-radio--on" : "")}>
              {schedule === f.key && <span className="set-radio-dot" />}
            </span>
            <div className="grow">
              <div style={{ fontWeight: 500 }}>{f.label}</div>
              <div className="faint" style={{ fontSize: 12 }}>
                {f.detail}
              </div>
            </div>
          </button>
        ))}
      </Card>
    </>
  );
}
