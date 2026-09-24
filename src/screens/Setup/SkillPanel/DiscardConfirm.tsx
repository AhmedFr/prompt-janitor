import { Button } from "@/components/Button";
import { DISCARD_BODY, DISCARD_TITLE } from "./SkillPanel.constants";

/**
 * In-panel rather than `window.confirm`: a native dialog blocks the whole
 * webview, and this one has to be reachable by the same tests and the same
 * keyboard as the panel it guards.
 */
export function DiscardConfirm({ onKeep, onDiscard }: { onKeep: () => void; onDiscard: () => void }) {
  return (
    <div className="sp__confirm" role="alertdialog" aria-label={DISCARD_TITLE}>
      <div className="sp__confirm-card">
        <h3 className="sp__confirm-title">{DISCARD_TITLE}</h3>
        <p className="muted sp__confirm-body">{DISCARD_BODY}</p>
        <div className="sp__confirm-actions">
          <Button size="sm" onClick={onKeep}>
            Keep editing
          </Button>
          <Button variant="primary" size="sm" onClick={onDiscard}>
            Discard
          </Button>
        </div>
      </div>
    </div>
  );
}
