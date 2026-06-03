import type { ScreenPlaceholderProps } from "./ScreenPlaceholder.types";

/**
 * Temporary empty-state for a screen that exists in the shell but is wired up in a later phase.
 * Replaced screen-by-screen during Phase 1.
 */
export function ScreenPlaceholder({ title, subtitle }: ScreenPlaceholderProps) {
  return (
    <section className="screen">
      <header className="screen__toolbar">
        <h1 className="screen__title">{title}</h1>
      </header>
      <div className="screen__empty">
        <p className="screen__empty-title">{title}</p>
        <p className="screen__empty-subtitle">{subtitle ?? "Coming together in an upcoming phase."}</p>
      </div>
    </section>
  );
}
