import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { BACK_LABEL } from "../Project.constants";
import type { StatePanelProps } from "./StatePanel.types";
import "./StatePanel.css";

/**
 * The three states that have no project to render: nothing selected, the read
 * failed, and nothing scanned matches the path. Each says which one it is —
 * a blank page would let all three read as "this project is empty" — and each
 * offers the way back, since the toolbar's arrow is not drawn without a
 * project loaded to go back from.
 */
export function StatePanel({ title, body, onBack, retry }: StatePanelProps) {
  return (
    <Card padded>
      <div className="project-panel">
        <h2 className="project-panel__title">{title}</h2>
        <p className="muted project-panel__body">{body}</p>
        <div className="project-panel__actions">
          {retry && (
            <Button onClick={retry.onClick}>
              <Icon name="refresh" /> {retry.label}
            </Button>
          )}
          {/* Primary only when it is the sole way forward; next to a retry it
              is the alternative, not the recommendation. */}
          <Button variant={retry ? undefined : "primary"} onClick={onBack}>
            {BACK_LABEL}
          </Button>
        </div>
      </div>
    </Card>
  );
}
