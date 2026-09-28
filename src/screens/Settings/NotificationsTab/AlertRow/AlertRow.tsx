import type { AlertRowProps } from "./AlertRow.types";

/** One notification setting: a label, its detail, and a toggle switch. */
export function AlertRow({ label, detail, on, onToggle }: AlertRowProps) {
  return (
    <div className="set-row">
      <div className="grow">
        <div style={{ fontWeight: 500 }}>{label}</div>
        <div className="faint" style={{ fontSize: 12 }}>
          {detail}
        </div>
      </div>
      <button
        className={"switch" + (on ? " on" : "")}
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onToggle}
      />
    </div>
  );
}
