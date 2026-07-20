import { useState } from "react";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { openExternal } from "@/lib/open-external";
import {
  POLAR_CHECKOUT_URL,
  GET_PRO_LABEL,
  FOUNDER_PRICE,
  PASTE_KEY_HINT_PREFIX,
  PASTE_KEY_HINT_LOCATION,
} from "@/lib/monetization";
import { STACKS, stackLabel } from "./TemplatePicker.constants";
import type { TemplatePickerProps } from "./TemplatePicker.types";
import "./TemplatePicker.css";

/**
 * "Start from a template" — an A-grade `CLAUDE.md`/`AGENTS.md` per stack for
 * developers who have no instruction file at all. Free users can browse and
 * read every template in full (an honest teaser); writing one to disk is the
 * paid one-click action, gated the same way Auto-fix is on VerdictHero.
 *
 * Purely presentational — data loading and the actual apply/rescan IO live in
 * `useTemplatePicker`, wired in by whichever screen renders this.
 */
export function TemplatePicker({ templates, entitled, loading, onApply, onClose, navigate }: TemplatePickerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ path: string; fileId: string | null } | null>(null);

  const selected = templates.find((t) => t.id === selectedId) ?? templates[0] ?? null;

  const handleUse = async () => {
    if (!selected) return;
    if (!entitled) {
      void openExternal(POLAR_CHECKOUT_URL);
      return;
    }
    setBusy(true);
    setError(null);
    const outcome = await onApply(selected.id);
    setBusy(false);
    if (outcome.status === "error") setError(outcome.message);
    else if (outcome.status === "done") setDone({ path: outcome.path, fileId: outcome.fileId });
  };

  const goToResult = () => {
    if (!done) return;
    onClose();
    navigate(done.fileId ? "detail" : "prompts", done.fileId ?? undefined);
  };

  return (
    <div className="tp-overlay" onClick={onClose}>
      <div className="tp-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Start from a template">
        <div className="tp-hd">
          <h2 className="tp-title">Start from a template</h2>
          <button className="tp-close" onClick={onClose} aria-label="Close">
            <Icon name="x" size={15} />
          </button>
        </div>

        {done ? (
          <div className="tp-done">
            <div className="tp-done-icon">
              <Icon name="check" size={22} />
            </div>
            <div className="tp-done-title">Added {done.path.split("/").pop()}</div>
            <div className="faint path" style={{ marginBottom: 18, textAlign: "center" }}>
              {done.path}
            </div>
            <Button variant="primary" size="sm" onClick={goToResult}>
              {done.fileId ? "View in Detail" : "Back to Prompts"}
            </Button>
          </div>
        ) : loading ? (
          <div className="tp-body">
            <div className="muted" style={{ padding: 22 }}>
              Loading templates…
            </div>
          </div>
        ) : (
          <div className="tp-body">
            <nav className="tp-list">
              {STACKS.map((stack) => (
                <div key={stack} className="tp-group">
                  <div className="tp-group-label">{stackLabel(stack)}</div>
                  {templates
                    .filter((t) => t.stack === stack)
                    .map((t) => (
                      <button
                        key={t.id}
                        className={"tp-item" + (selected?.id === t.id ? " tp-item--on" : "")}
                        aria-label={`${stackLabel(t.stack)} ${t.file_type}`}
                        aria-pressed={selected?.id === t.id}
                        onClick={() => {
                          setSelectedId(t.id);
                          setError(null);
                        }}
                      >
                        {t.file_type}
                      </button>
                    ))}
                </div>
              ))}
            </nav>

            {selected && (
              <div className="tp-preview">
                <div className="tp-preview-hd">
                  <div className="tp-preview-title">{selected.title}</div>
                  <div className="faint" style={{ fontSize: 12 }}>
                    {selected.description}
                  </div>
                </div>
                <pre className="tp-code">{selected.preview}</pre>

                {error && (
                  <div className="faint" style={{ fontSize: 12, color: "var(--red)", marginTop: 10 }}>
                    {error}
                  </div>
                )}

                <div className="row wrap" style={{ gap: 10, marginTop: 14, alignItems: "center" }}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void handleUse()}
                    disabled={busy}
                    title={
                      entitled
                        ? "Write this file into a folder you choose"
                        : `Get Pro to apply templates — ${FOUNDER_PRICE}`
                    }
                  >
                    <Icon name={entitled ? "wand" : "lock"} />{" "}
                    {busy ? "Applying…" : entitled ? "Use this template" : GET_PRO_LABEL}
                  </Button>
                  {!entitled && (
                    <span className="faint" style={{ fontSize: 12 }}>
                      {PASTE_KEY_HINT_PREFIX}{" "}
                      <button
                        className="tp-link"
                        onClick={() => {
                          onClose();
                          navigate("settings", "license");
                        }}
                      >
                        {PASTE_KEY_HINT_LOCATION}
                      </button>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
