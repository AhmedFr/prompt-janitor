import "./cells.css";
import type { MouseEvent } from "react";
import { Icon } from "@/components/Icon";
import type { ActionsCellProps, RowAction } from "./cells.types";

/**
 * Trailing icon buttons for a row. Clicks stop propagating: the row itself is
 * often clickable, and "delete" must never also mean "open".
 */
export function ActionsCell({ actions }: ActionsCellProps) {
  const run = (action: RowAction) => (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    action.onClick();
  };

  return (
    <span className="dt-actions">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          className="dt-actions__btn"
          aria-label={action.label}
          title={action.label}
          disabled={action.disabled}
          onClick={run(action)}
        >
          <Icon name={action.icon} size={15} />
        </button>
      ))}
    </span>
  );
}
