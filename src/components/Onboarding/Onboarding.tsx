import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { commands } from "@/lib/ipc";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import "./Onboarding.css";

const STEPS = ["Folder", "Rules", "Schedule"] as const;

const PACKS = [
  { id: "anthropic", label: "Anthropic", desc: "Be explicit, avoid contradictions" },
  { id: "openai", label: "OpenAI", desc: "Examples, output formats, structure" },
  { id: "karpathy", label: "Karpathy & friends", desc: "No stale models, short > long" },
];

const FREQS: [string, string, string][] = [
  ["1h", "Hourly", "Most up-to-date"],
  ["6h", "Every 6 hours", "Recommended"],
  ["1d", "Once a day", "Light touch"],
  ["save", "On save", "Watch mode"],
  ["manual", "Manual only", "Scan when you click"],
];

interface Progress {
  done: number;
  total: number;
}

export interface OnboardingProps {
  onDone: () => void;
}

export function Onboarding({ onDone }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [folder, setFolder] = useState<string | null>(null);
  const [freq, setFreq] = useState("6h");
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);

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

  const finish = async () => {
    if (!folder) return;
    setScanning(true);
    await commands.setScanFolder(folder);
    await commands.setSchedule(freq);
    await commands.scanNow(folder);
    onDone();
  };

  if (scanning) {
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

  return (
    <div className="ob-overlay">
      <div className="ob-card">
        <div className="ob-steps">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={"ob-chip" + (i === step ? " ob-chip--on" : "")}
              style={{ opacity: i <= step ? 1 : 0.5 }}
            >
              {i + 1} · {s}
            </span>
          ))}
        </div>

        {step === 0 && (
          <div className="ob-body">
            <div className="ob-logo" aria-hidden="true">
              🧹
            </div>
            <h2 className="ob-title">Where should I look for prompts?</h2>
            <p className="muted ob-sub">
              I&apos;ll find AGENTS.md, CLAUDE.md, .cursorrules and other AI prompt files inside this folder.
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
          </div>
        )}

        {step === 1 && (
          <div className="ob-body">
            <h2 className="ob-title">Which standards should I grade against?</h2>
            <p className="muted ob-sub">
              Prompt Janitor grades against trusted playbooks. You can fine-tune every rule later in Rules.
            </p>
            <div className="ob-packs">
              {PACKS.map((p) => (
                <div key={p.id} className="ob-pack">
                  <div style={{ fontWeight: 600 }}>{p.label}</div>
                  <div className="faint" style={{ fontSize: 12 }}>
                    {p.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="ob-body">
            <h2 className="ob-title">How often should I scan?</h2>
            <p className="muted ob-sub">
              Background scans keep your grades fresh. Change this anytime in Settings.
            </p>
            <div className="ob-freqs">
              {FREQS.map(([key, label, desc]) => (
                <button
                  key={key}
                  className={"ob-freq" + (freq === key ? " ob-freq--on" : "")}
                  onClick={() => setFreq(key)}
                >
                  <span className="ob-radio">{freq === key && <span className="ob-radio-dot" />}</span>
                  <span className="grow">
                    <span style={{ fontWeight: 500 }}>{label}</span>{" "}
                    <span className="faint" style={{ fontSize: 12 }}>
                      · {desc}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="ob-footer">
          <Button size="sm" onClick={() => (step === 0 ? onDone() : setStep(step - 1))}>
            {step === 0 ? "Skip setup" : "Back"}
          </Button>
          {step < 2 ? (
            <Button
              variant="primary"
              size="sm"
              disabled={step === 0 && !folder}
              onClick={() => setStep(step + 1)}
            >
              Next: {STEPS[step + 1]} →
            </Button>
          ) : (
            <Button variant="primary" size="sm" disabled={!folder} onClick={() => void finish()}>
              <Icon name="sparkles" /> Run first scan
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
