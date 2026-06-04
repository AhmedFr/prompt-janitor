import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import type { LicenseTabProps } from "./LicenseTab.types";

const fieldStyle = { display: "block", marginTop: 12 } as const;
const labelStyle = { display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6 } as const;

/** Settings → License: activate the offline key that unlocks the paid tier. */
export function LicenseTab({ entitlement, onActivate, onRemove }: LicenseTabProps) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const paid = entitlement?.paid ?? false;

  const activate = async () => {
    if (!key.trim()) return;
    setBusy(true);
    setStatus(null);
    const msg = await onActivate(key.trim());
    setStatus(msg);
    setKey("");
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    setStatus(null);
    await onRemove();
    setStatus("License removed — back on the free tier.");
    setBusy(false);
  };

  return (
    <>
      <h2 className="set-sec">License</h2>
      <Card padded>
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <span
            className="chip on"
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Icon name={paid ? "check" : "sparkles"} size={13} /> {paid ? "Pro" : "Free"}
          </span>
          <span className="faint" style={{ fontSize: 13 }}>
            {paid
              ? `Paid features unlocked${entitlement?.email ? ` · ${entitlement.email}` : ""}`
              : "Auto-fix, AI rewrites & natural-language rules are locked."}
          </span>
        </div>

        {paid ? (
          <div className="row" style={{ gap: 8, marginTop: 16 }}>
            <Button size="sm" onClick={() => void remove()} disabled={busy}>
              <Icon name="x" /> Remove license
            </Button>
            {status && (
              <span className="faint" style={{ fontSize: 13, alignSelf: "center" }}>
                {status}
              </span>
            )}
          </div>
        ) : (
          <>
            <label style={fieldStyle}>
              <span style={labelStyle}>License key</span>
              <input
                className="input"
                placeholder="PJ1.…"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void activate();
                }}
              />
            </label>
            <div className="row" style={{ gap: 8, marginTop: 14, alignItems: "center" }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void activate()}
                disabled={busy || !key.trim()}
              >
                <Icon name="check" /> {busy ? "Checking…" : "Activate"}
              </Button>
              {status && (
                <span className="faint" style={{ fontSize: 13 }}>
                  {status}
                </span>
              )}
            </div>
          </>
        )}

        <p className="faint" style={{ fontSize: 12, marginTop: 14, maxWidth: 560 }}>
          The key is verified on your machine — no internet required, nothing leaves the app.
        </p>
      </Card>
    </>
  );
}
