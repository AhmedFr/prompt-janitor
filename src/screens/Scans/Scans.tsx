import { Grade } from "@/components/Grade";
import { SeverityDot } from "@/components/SeverityDot";
import { Sparkline } from "@/components/Sparkline";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { isTauri, type ScansDigest } from "@/lib/ipc";
import type { Navigate } from "@/App/App.types";
import { useScansDigest } from "./useScansDigest";
import "./Scans.css";

export interface ScansProps {
  navigate: Navigate;
}

export function Scans({ navigate }: ScansProps) {
  const { digest, loading } = useScansDigest();

  return (
    <section className="screen">
      <header className="screen__toolbar" data-tauri-drag-region>
        <h1 className="screen__title">Scans</h1>
      </header>
      <div className="scroll-area">
        <div className="page">
          {!isTauri ? (
            <Card padded>
              <div className="muted">Open the desktop app to see scan history.</div>
            </Card>
          ) : loading ? (
            <Card padded>
              <div className="muted">Loading…</div>
            </Card>
          ) : !digest?.has_data ? (
            <>
              <Card padded>
                <div className="muted">No scans yet — run a scan from the Overview tab.</div>
              </Card>
              {/* An empty digest can still be the *result* of a scan whose logs
                  would not parse; the caveat explains the emptiness. */}
              <SkippedLines count={digest?.skipped_lines ?? 0} />
            </>
          ) : (
            <DigestBody digest={digest} navigate={navigate} />
          )}
        </div>
      </div>
    </section>
  );
}

function DigestBody({ digest, navigate }: { digest: ScansDigest; navigate: Navigate }) {
  return (
    <>
      <Card padded>
        <div className="row between">
          <div>
            <div className="s-title">This week in your prompts</div>
            <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>
              {digest.scan_count} scans
            </div>
          </div>
          <Grade grade={digest.overall_grade} size="lg" />
        </div>

        <div className="s-tiles">
          <Tile
            value={`${digest.net_health > 0 ? "+" : ""}${digest.net_health}`}
            label="net health"
            color={digest.net_health >= 0 ? "var(--green)" : "var(--red)"}
          />
          <Tile value={`${digest.improved}`} label="files improved" color="var(--text)" />
          <Tile
            value={`${digest.regressed}`}
            label="regressed"
            color={digest.regressed > 0 ? "var(--red)" : "var(--text-3)"}
          />
        </div>

        {digest.trend.length > 1 && (
          <div style={{ marginTop: 18 }}>
            <Sparkline data={digest.trend} height={56} />
          </div>
        )}
      </Card>

      <h2 className="sec" style={{ margin: "22px 0 10px" }}>
        Needs your eyes
      </h2>
      {digest.needs_attention.length === 0 ? (
        <Card padded>
          <div className="muted">Nothing pressing — grades are holding steady. 🎉</div>
        </Card>
      ) : (
        <Card>
          <div className="s-list">
            {digest.needs_attention.map((item, i) => (
              <button key={i} className="s-row" onClick={() => navigate("detail", item.file_id)}>
                <DigestIcon kind={item.kind} />
                <div className="grow">
                  <div style={{ fontWeight: 500 }}>{item.title}</div>
                  <div className="path" style={{ marginTop: 2 }}>
                    {item.detail}
                  </div>
                </div>
                <span className="s-chev">
                  <Icon name="chevronRight" size={16} />
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <SkippedLines count={digest.skipped_lines} />

      <div className="row between" style={{ marginTop: 16 }}>
        <span className="faint" style={{ fontSize: 12 }}>
          {digest.scan_count} scans recorded
        </span>
        <Button size="sm" onClick={() => navigate("overview")}>
          Review on Overview →
        </Button>
      </div>
    </>
  );
}

/** The indexer's own caveat: how much of the logs it could not read. */
function SkippedLines({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="muted" style={{ marginTop: 16, fontSize: 12 }}>
      {count} log line{count === 1 ? "" : "s"} skipped while indexing
    </div>
  );
}

function Tile({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="s-tile">
      <div className="s-tile-value tnum" style={{ color }}>
        {value}
      </div>
      <div className="faint" style={{ fontSize: 12 }}>
        {label}
      </div>
    </div>
  );
}

function DigestIcon({ kind }: { kind: string }) {
  if (kind === "improved") {
    return (
      <span className="s-ico-improved">
        <Icon name="sparkles" size={18} />
      </span>
    );
  }
  return <SeverityDot level={kind === "regressed" ? "hi" : "mid"} />;
}
