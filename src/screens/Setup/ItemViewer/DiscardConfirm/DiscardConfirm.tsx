import { Button } from "@/components/Button";
import { DISCARD, DISCARD_BODY, DISCARD_TITLE, KEEP_EDITING } from "./DiscardConfirm.constants";
import type { DiscardConfirmProps } from "./DiscardConfirm.types";

/**
 * In-panel rather than `window.confirm`: a native dialog blocks the whole
 * webview, and this one has to be reachable by the same tests and the same
 * keyboard as the viewer it guards.
 */
export function DiscardConfirm({ onKeep, onDiscard }: DiscardConfirmProps) {
  return (
    <div className="sp__confirm" role="alertdialog" aria-label={DISCARD_TITLE}>
      <div className="sp__confirm-card">
        <h3 className="sp__confirm-title">{DISCARD_TITLE}</h3>
        <p className="muted sp__confirm-body">{DISCARD_BODY}</p>
        <div className="sp__confirm-actions">
          <Button size="sm" onClick={onKeep}>
            {KEEP_EDITING}
          </Button>
          <Button variant="primary" size="sm" onClick={onDiscard}>
            {DISCARD}
          </Button>
        </div>
      </div>
    </div>
  );
}
