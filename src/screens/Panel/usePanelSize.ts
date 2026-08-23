import { useEffect, useRef } from "react";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@/lib/ipc";
import { PANEL_WIDTH } from "./Panel.constants";
import { panelHeight } from "./panel.util";

/**
 * Keeps the panel window the height of the card inside it.
 *
 * The window was a fixed 360 × 480, so a short answer — nothing to fix, one
 * signal chip — left a band of dead space under the footer, and the popover
 * read as a form that failed to load. The card is measured instead and the
 * window follows it, clamped by {@link panelHeight}.
 *
 * The window is only ever resized when the measurement actually moves: a
 * `ResizeObserver` fires on every layout pass the card is involved in, and
 * asking the window server for the size it already has is work that can
 * flicker.
 *
 * @returns the ref to put on the card element.
 */
export function usePanelSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  /** The height the window was last asked for; `null` until the first call. */
  const applied = useRef<number | null>(null);

  useEffect(() => {
    const card = ref.current;
    // Storybook, the test runner and the browser build have no window to size.
    if (!isTauri || !card) return;

    const apply = () => {
      const height = panelHeight(card.offsetHeight);
      if (height === applied.current) return;
      applied.current = height;
      // A rejected resize is not worth a crash overlay: the panel is readable
      // at whatever size the window happens to have.
      void getCurrentWindow()
        .setSize(new LogicalSize(PANEL_WIDTH, height))
        .catch(() => {});
    };

    // The first measurement is the one that matters — the window opens at the
    // size the builder gave it, and the card is already laid out by now.
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  return ref;
}
