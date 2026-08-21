import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { ScoreRing } from "@/components/ScoreRing";
import { useVerdictHero, verdictSentence } from "@/components/VerdictHero";
import type { HarnessInfo, ScanSummary } from "@/lib/ipc";
import { useOnboarding } from "./useOnboarding";
import "./Onboarding.css";

const STEPS = ["Detect", "Scan", "Verdict"] as const;

export interface OnboardingProps {
  onDone: () => void;
}

/** "1 global setup · 12 projects · 88 sessions", summed over every harness found. */
function detectedSummary(detected: HarnessInfo[]): string {
  const projects = detected.reduce((n, h) => n + h.project_count, 0);
  const sessions = detected.reduce((n, h) => n + h.session_count, 0);
  const setups = detected.length;
  return [
    `${setups} global ${setups === 1 ? "setup" : "setups"}`,
    `${projects} ${projects === 1 ? "project" : "projects"}`,
    `${sessions} ${sessions === 1 ? "session" : "sessions"}`,
  ].join(" · ");
}

/**
 * First-run flow, tuned for time-to-verdict: show what is installed, scan it,
 * and land on the grade. All the detection and scan plumbing lives in
 * {@link useOnboarding}; this is the layout.
 */
export function Onboarding({ onDone }: OnboardingProps) {
  const { detected, step, status, progress, summary, failed, start, addFolder } = useOnboarding();

  useEffect(() => {
    if (failed) onDone();
  }, [failed, onDone]);

  if (step === "scanning") {
    return (
      <Shell step={1} labelledBy="ob-title">
        <div className="ob-scanning">
          <div className="ob-logo" aria-hidden="true">
            🧹
          </div>
          <h2 className="ob-title" id="ob-title">
            Scanning…
          </h2>
          <div className="bar" style={{ width: "100%" }}>
            <i
              style={{
                width: `${progress && progress.total ? (progress.done / progress.total) * 100 : 8}%`,
                transition: "width .15s",
              }}
            />
          </div>
          <div className="faint tnum" style={{ fontSize: 12 }}>
            {status}
          </div>
        </div>
      </Shell>
    );
  }

  if (step === "reveal" && summary) {
    return <Reveal summary={summary} onDone={onDone} />;
  }

  const found = detected.length > 0;

  return (
    <Shell step={0} labelledBy="ob-title">
      <div className="ob-body">
        <div className="ob-logo" aria-hidden="true">
          🧹
        </div>
        <h2 className="ob-title" id="ob-title">
          {found
            ? `Detected: ${detected.map((h) => h.display_name).join(", ")}`
            : "No supported agent harness found"}
        </h2>
        <p className="muted ob-sub">
          {found
            ? detectedSummary(detected)
            : "Nothing on this machine looks like a supported agent harness. Point Prompt Janitor at a folder and it will grade the prompt files inside."}
        </p>
        {found && (
          <p className="faint ob-note">
            Prompt Janitor grades the rules, skills and agents your coding agent already loads. Add
            a folder only if you keep prompts somewhere it never opens.
          </p>
        )}
        {found && (
          <Button onClick={() => void addFolder()}>
            <Icon name="folder" /> Add a folder…
          </Button>
        )}
      </div>

      <div className="ob-footer">
        <Button size="sm" onClick={onDone}>
          Skip setup
        </Button>
        {found ? (
          <Button variant="primary" size="sm" onClick={() => void start()}>
            <Icon name="sparkles" /> Scan everything
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={() => void addFolder()}>
            <Icon name="folder" /> Add a folder
          </Button>
        )}
      </div>
    </Shell>
  );
}

/** The modal card and its step indicator — the frame every step renders inside. */
function Shell({
  step,
  labelledBy,
  children,
}: {
  step: number;
  labelledBy: string;
  children: ReactNode;
}) {
  return (
    <div className="ob-overlay">
      <div className="ob-card" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <div className="ob-steps">
          {STEPS.map((s, i) => (
            <span key={s} className={"ob-chip" + (i === step ? " ob-chip--on" : "")}>
              {i + 1} · {s}
            </span>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

/** The reveal: the just-computed grade, its verdict sentence, and one way forward. */
function Reveal({ summary, onDone }: { summary: ScanSummary; onDone: () => void }) {
  // The hero hook supplies the computed "n fixes from an A" for the B verdict.
  const { verdict } = useVerdictHero();
  const grade = summary.overall_grade;
  const sentence =
    grade === "B" && verdict.loading ? null : verdictSentence(grade, verdict.fixesToA);

  return (
    <Shell step={2} labelledBy="ob-verdict">
      <div className="ob-body ob-reveal">
        <ScoreRing score={summary.overall_score} grade={grade} size={132} />
        <h2 className="ob-verdict" id="ob-verdict">
          {sentence ?? `Grade ${grade}`}
        </h2>
        <div className="muted" style={{ fontSize: 13 }}>
          {summary.files_scanned} prompt file{summary.files_scanned === 1 ? "" : "s"} graded across{" "}
          {summary.projects} project{summary.projects === 1 ? "" : "s"}.
        </div>
      </div>

      <div className="ob-footer" style={{ justifyContent: "flex-end" }}>
        <Button variant="primary" size="sm" onClick={onDone}>
          See what to fix →
        </Button>
      </div>
    </Shell>
  );
}
