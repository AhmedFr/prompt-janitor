import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { commands, type ScanSummary } from "@/lib/ipc";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { ScoreRing } from "@/components/ScoreRing";
import { useVerdictHero, verdictSentence } from "@/components/VerdictHero";
import "./Onboarding.css";

const STEPS = ["Folder", "Scan", "Verdict"] as const;

interface Progress {
  done: number;
  total: number;
}

type Step = "folder" | "scanning" | "reveal";

export interface OnboardingProps {
  onDone: () => void;
}

/**
 * First-run flow, tuned for time-to-verdict: pick a folder, scan, and land on
 * the grade. Standards packs and the scan schedule are not asked about — the
 * backend defaults (all packs on, every 6 hours) already apply, and both live
 * in Settings.
 */
export function Onboarding({ onDone }: OnboardingProps) {
  const [step, setStep] = useState<Step>("folder");
  const [folder, setFolder] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [summary, setSummary] = useState<ScanSummary | null>(null);

  useEffect(() => {
    const unlisten = listen<Progress>("scan-progress", (e) => setProgress(e.payload));
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const pickFolder = async () => {
    const dir = await open({ directory: true, multiple: false, title: "Choose a folder to scan" });
    if (typeof dir === "string") setFolder(dir);
  };

  const runFirstScan = async () => {
    if (!folder) return;
    setStep("scanning");
    await commands.setScanFolder(folder);
    const res = await commands.scanNow(folder);
    if (res.status === "ok") {
      setSummary(res.data);
      setStep("reveal");
    } else {
      // The scan failed — don't trap the user in onboarding.
      onDone();
    }
  };

  if (step === "scanning") {
    return (
      <div className="ob-overlay">
        <div className="ob-card">
          <div className="ob-scanning">
            <div className="ob-logo">🧹</div>
            <h2 className="ob-title">Scanning…</h2>
            <div className="bar" style={{ width: "100%" }}>
              <i
                style={{
                  width: `${progress && progress.total ? (progress.done / progress.total) * 100 : 8}%`,
                  transition: "width .15s",
                }}
              />
            </div>
            <div className="faint tnum" style={{ fontSize: 12 }}>
              {progress ? `${progress.done} of ${progress.total} files` : "Finding prompt files…"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "reveal" && summary) {
    return <Reveal summary={summary} onDone={onDone} />;
  }

  return (
    <div className="ob-overlay">
      <div className="ob-card">
        <div className="ob-steps">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={"ob-chip" + (i === 0 ? " ob-chip--on" : "")}
              style={{ opacity: i === 0 ? 1 : 0.5 }}
            >
              {i + 1} · {s}
            </span>
          ))}
        </div>

        <div className="ob-body">
          <div className="ob-logo" aria-hidden="true">
            🧹
          </div>
          <h2 className="ob-title">Where should I look for prompts?</h2>
          <p className="muted ob-sub">
            I&apos;ll find AGENTS.md, CLAUDE.md, .cursorrules and other AI prompt files inside this
            folder.
          </p>
          {folder && (
            <div className="ob-folder">
              <Icon name="folder" size={16} />
              <span className="path">{folder}</span>
            </div>
          )}
          <Button variant={folder ? "default" : "primary"} onClick={() => void pickFolder()}>
            <Icon name="folder" /> {folder ? "Choose a different folder…" : "Choose a folder…"}
          </Button>
          <p className="faint" style={{ fontSize: 12, marginTop: 16, marginBottom: 0 }}>
            Standards packs and scan schedule start with sensible defaults — change them anytime in
            Settings.
          </p>
        </div>

        <div className="ob-footer">
          <Button size="sm" onClick={onDone}>
            Skip setup
          </Button>
          <Button variant="primary" size="sm" disabled={!folder} onClick={() => void runFirstScan()}>
            <Icon name="sparkles" /> Run first scan
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Step 3 — the reveal: the just-computed grade, its verdict sentence, and one
 * way forward. */
function Reveal({ summary, onDone }: { summary: ScanSummary; onDone: () => void }) {
  // The hero hook supplies the computed "n fixes from an A" for the B verdict.
  const { verdict } = useVerdictHero();
  const grade = summary.overall_grade;
  const sentence =
    grade === "B" && verdict.loading ? null : verdictSentence(grade, verdict.fixesToA);

  return (
    <div className="ob-overlay">
      <div className="ob-card">
        <div className="ob-steps">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={"ob-chip" + (i === 2 ? " ob-chip--on" : "")}
              style={{ opacity: 1 }}
            >
              {i + 1} · {s}
            </span>
          ))}
        </div>

        <div className="ob-body ob-reveal">
          <ScoreRing score={summary.overall_score} grade={grade} size={132} />
          {sentence && <div className="ob-verdict">{sentence}</div>}
          <div className="muted" style={{ fontSize: 13 }}>
            {summary.files_scanned} prompt file{summary.files_scanned === 1 ? "" : "s"} graded
            across {summary.projects} project{summary.projects === 1 ? "" : "s"}.
          </div>
        </div>

        <div className="ob-footer" style={{ justifyContent: "flex-end" }}>
          <Button variant="primary" size="sm" onClick={onDone}>
            See what to fix →
          </Button>
        </div>
      </div>
    </div>
  );
}
