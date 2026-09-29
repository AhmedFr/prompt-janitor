import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { detectedSummary } from "./onboarding.util";
import { scanPercent } from "@/lib/useScanProgress";
import { useOnboarding } from "./useOnboarding";
import type { OnboardingProps } from "./Onboarding.types";
import { LABEL } from "@/lib/vocabulary";
import "./Onboarding.css";

const STEPS = ["Detect", "Scan", "Setup"] as const;

/**
 * First-run flow, tuned for time-to-verdict: show what is installed, scan it,
 * and open the setup. All the detection and scan plumbing lives in
 * {@link useOnboarding}; this is the layout.
 */
export function Onboarding({ onDone, state }: OnboardingProps) {
  const live = useOnboarding();
  const { detected, step, status, progress, setupLine, failed, start, addFolder } = state ?? live;

  useEffect(() => {
    if (failed) onDone();
  }, [failed, onDone]);

  if (step === "detecting") {
    return (
      <Shell step={0} stepKey={step} labelledBy="ob-title" onEscape={onDone}>
        <div className="ob-body">
          <div className="ob-logo" aria-hidden="true">
            🧹
          </div>
          <h2 className="ob-title" id="ob-title">
            Looking for your agent setup…
          </h2>
          <p className="muted ob-sub">
            Checking this machine for a supported coding agent and the prompt files it already
            loads.
          </p>
        </div>
      </Shell>
    );
  }

  if (step === "scanning") {
    return (
      <Shell step={1} stepKey={step} labelledBy="ob-title">
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
                width: `${scanPercent(progress)}%`,
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

  if (step === "reveal" && setupLine) {
    return <Reveal line={setupLine} onDone={onDone} />;
  }

  const found = detected.length > 0;

  return (
    <Shell step={0} stepKey={step} labelledBy="ob-title" onEscape={onDone}>
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
            Prompt Janitor grades the instructions, skills and agents your coding agent already
            loads. Point it at another folder only if you keep prompts somewhere it never opens.
          </p>
        )}
        {found && (
          <Button onClick={() => void addFolder()}>
            <Icon name="folder" /> {LABEL.addFolder}
          </Button>
        )}
      </div>

      <div className="ob-footer">
        <Button size="sm" onClick={onDone}>
          Skip setup
        </Button>
        {found ? (
          <Button variant="primary" size="sm" onClick={() => void start()}>
            <Icon name="sparkles" /> {LABEL.scan}
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={() => void addFolder()}>
            <Icon name="folder" /> {LABEL.addFolder}
          </Button>
        )}
      </div>
    </Shell>
  );
}

/**
 * The modal card and its step indicator — the frame every step renders inside.
 * It takes focus on mount, and again whenever the step changes: the card is one
 * React element across all four screens, so without `stepKey` the focus would
 * stay wherever the last click left it while the whole dialog swapped contents
 * underneath the user. `onEscape` is only wired up where backing out is safe:
 * dismissing mid-scan would leave the scan running with nothing on screen to
 * explain it.
 */
function Shell({
  step,
  stepKey,
  labelledBy,
  onEscape,
  children,
}: {
  step: number;
  /** The flow step this frame is showing; a change re-takes focus. */
  stepKey: string;
  labelledBy: string;
  onEscape?: () => void;
  children: ReactNode;
}) {
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    card.current?.focus();
  }, [stepKey]);

  return (
    <div className="ob-overlay">
      <div
        ref={card}
        className="ob-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key !== "Escape" || !onEscape) return;
          e.stopPropagation();
          onEscape();
        }}
      >
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

/** The reveal: a one-line summary of the setup just scanned, and the way into it. */
function Reveal({ line, onDone }: { line: string; onDone: () => void }) {
  return (
    <Shell step={2} stepKey="reveal" labelledBy="ob-verdict">
      <div className="ob-body ob-reveal">
        <h2 className="ob-verdict" id="ob-verdict">
          Your setup
        </h2>
        <div className="muted" style={{ fontSize: 13 }}>
          {line}
        </div>
      </div>

      <div className="ob-footer" style={{ justifyContent: "flex-end" }}>
        <Button variant="primary" size="sm" onClick={onDone}>
          Open my setup
        </Button>
      </div>
    </Shell>
  );
}
