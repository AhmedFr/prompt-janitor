import { useEffect } from "react";

/**
 * ⌘↑/⌘↓ step through the rows on screen, calling `onStep(-1 | 1)`.
 *
 * Off while `enabled` is false (the viewer is editing: a step would throw the
 * draft away) and from a focused text field such as the find bar, where
 * ⌘↑/⌘↓ move the caret.
 */
export function useStepKeys(onStep: ((delta: -1 | 1) => void) | undefined, enabled: boolean): void {
  useEffect(() => {
    if (!onStep || !enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      onStep(e.key === "ArrowUp" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStep, enabled]);
}
