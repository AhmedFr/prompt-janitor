import { Grade } from "@/components/Grade";
import { ScoreRing } from "@/components/ScoreRing";
import { SeverityDot } from "@/components/SeverityDot";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { openExternal } from "@/lib/open-external";
import {
  POLAR_CHECKOUT_URL,
  PASTE_KEY_HINT_PREFIX,
  PASTE_KEY_HINT_LOCATION,
} from "@/lib/monetization";
import { verdictSentence, costSentence } from "./VerdictHero.constants";
import type { VerdictHeroProps } from "./VerdictHero.types";
import "./VerdictHero.css";

/**
 * The verdict-first hero at the top of the Overview: the overall grade, what
 * it means, what it costs, and the fastest path to an A — answerable in
 * seconds, before any scrolling.
 */
export function VerdictHero({
  data,
  verdict,
  scanning,
  autoFixBusy,
  onScanNow,
  onAutoFix,
  navigate,
}: VerdictHeroProps) {
  const grade = data.overall_grade;
  // The B sentence needs the computed n — hold it back for the brief moment
  // the fix data is still loading rather than showing a wrong number.
  const sentence = grade === "B" && verdict.loading ? null : verdictSentence(grade, verdict.fixesToA);
  const locked = !verdict.entitled;

  const handleAutoFix = () => {
    if (locked) {
      void openExternal(POLAR_CHECKOUT_URL);
      return;
    }
    onAutoFix();
  };

  return (
    <Card padded>
      <div className="row wrap" style={{ gap: 20, alignItems: "center" }}>
        <ScoreRing score={data.overall_score} grade={grade} size={120} />
        <div className="grow" style={{ minWidth: 260 }}>
          {sentence && <div className="vh-verdict">{sentence}</div>}
          {data.critical > 0 && <div className="vh-cost">{costSentence(data.critical)}</div>}
          <div className="row wrap" style={{ gap: 16, marginTop: 10, fontSize: 12 }}>
            <span className="muted">
              {data.file_count} prompt files · {data.project_count} projects
            </span>
            <span className="row" style={{ gap: 6 }}>
              <SeverityDot level="hi" /> {data.critical} critical
            </span>
            <span className="row" style={{ gap: 6 }}>
              <SeverityDot level="mid" /> {data.warnings} warnings
            </span>
            <span className="row" style={{ gap: 6 }}>
              <SeverityDot level="lo" /> {data.nits} nits
            </span>
          </div>
          {data.scan_folder && (
            <div className="path faint" style={{ marginTop: 4 }}>
              {data.scan_folder}
            </div>
          )}
        </div>
      </div>

      {verdict.fixPath.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="vh-sec">Fastest path to an A</div>
          <div className="vh-list">
            {verdict.fixPath.map((row, i) => (
              <button key={i} className="vh-row" onClick={() => navigate("detail", row.fileId)}>
                <SeverityDot level={row.severity} />
                <span className="path">{row.fileName}</span>
                <span className="grow" style={{ fontWeight: 500 }}>
                  {row.title}
                </span>
                <span className="vh-points tnum">
                  {row.points > 0 ? `+${row.points} pts` : "unblocks pts"}
                </span>
                <span className="vh-chev">
                  <Icon name="chevronRight" size={14} />
                </span>
              </button>
            ))}
          </div>
          {verdict.projectedGrade && (
            <div className="row" style={{ gap: 8, marginTop: 10, fontSize: 13, alignItems: "center" }}>
              <span className="muted">
                Fix these {verdict.fixPath.length} →
              </span>
              <Grade grade={verdict.projectedGrade} size="sm" />
            </div>
          )}
        </div>
      )}

      {!verdict.loading && (
        <div className="vh-coverage faint">
          {verdict.aiReady ? (
            <>Grading against {verdict.totalStandards} standards.</>
          ) : (
            <>
              Graded on {verdict.detStandards} of {verdict.totalStandards} standards —{" "}
              <button className="vh-link" onClick={() => navigate("settings", "ai")}>
                connect a model to grade all {verdict.totalStandards}
              </button>
              .
            </>
          )}
        </div>
      )}

      <div className="row wrap" style={{ gap: 10, marginTop: 14, alignItems: "center" }}>
        {verdict.autofixCount > 0 && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleAutoFix}
            disabled={autoFixBusy || scanning}
            title={
              locked
                ? "Auto-fix is a Pro feature — get a license"
                : "Apply every deterministic fix across all files"
            }
          >
            <Icon name={locked ? "lock" : "wand"} />{" "}
            {autoFixBusy ? "Fixing…" : `Auto-fix ${verdict.autofixCount}`}
          </Button>
        )}
        <Button size="sm" onClick={onScanNow} disabled={scanning || autoFixBusy}>
          <Icon name="refresh" /> {scanning ? "Scanning…" : "Scan now"}
        </Button>
        {locked && verdict.autofixCount > 0 && (
          <span className="faint" style={{ fontSize: 12 }}>
            {PASTE_KEY_HINT_PREFIX}{" "}
            <button className="vh-link" onClick={() => navigate("settings", "license")}>
              {PASTE_KEY_HINT_LOCATION}
            </button>
          </span>
        )}
      </div>
    </Card>
  );
}
