import { Card } from "@/components/Card";
import { AlertRow } from "./AlertRow";
import type { NotificationsTabProps } from "./NotificationsTab.types";

/** Settings → Notifications: the weekly digest and the regression alert. */
export function NotificationsTab({
  digest,
  regressions,
  onDigest,
  onRegressions,
}: NotificationsTabProps) {
  return (
    <>
      <h2 className="set-sec">Notifications</h2>
      <Card>
        <AlertRow
          label="Weekly digest"
          detail="A summary of the week's changes"
          on={digest}
          onToggle={() => onDigest(!digest)}
        />
        <AlertRow
          label="Alert when a file regresses a grade"
          detail="Notify when a grade drops"
          on={regressions}
          onToggle={() => onRegressions(!regressions)}
        />
      </Card>
      <p className="faint" style={{ fontSize: 12, marginTop: 12, maxWidth: 560 }}>
        A calm cadence — periodic summaries with regression alerts, no constant pinging.
      </p>
    </>
  );
}
