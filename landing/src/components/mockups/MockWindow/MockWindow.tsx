import type { MockWindowProps } from "./MockWindow.types";

export function MockWindow({ title, children }: MockWindowProps) {
  return (
    <div className="mk-win" aria-hidden="true">
      <div className="mk-titlebar">
        <span className="mk-dot r" />
        <span className="mk-dot y" />
        <span className="mk-dot g" />
        <span className="mk-title">{title}</span>
      </div>
      {children}
    </div>
  );
}
