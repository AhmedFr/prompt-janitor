import type { FixDiffProps } from "./FixDiff.types";
import "./FixDiff.css";

/** Presentational from → to diff. */
export function FixDiff({ from, to, note, ai }: FixDiffProps) {
  return (
    <div style={{ marginTop: 14 }}>
      <h2 className="sec">{ai ? "AI suggested rewrite" : "Suggested fix"}</h2>
      {from && (
        <div className="d-diff-line d-diff-from" style={{ whiteSpace: "pre-wrap" }}>
          <span style={{ color: "var(--red)" }}>− </span>
          {from}
        </div>
      )}
      <div className="d-diff-line d-diff-to" style={{ whiteSpace: "pre-wrap" }}>
        <span style={{ color: "var(--green)" }}>+ </span>
        {to}
      </div>
      {note && (
        <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>
          {note}
        </div>
      )}
    </div>
  );
}
