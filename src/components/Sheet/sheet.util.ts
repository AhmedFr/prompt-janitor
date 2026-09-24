import type { KeyboardEvent } from "react";

/** Everything inside the sheet that can hold focus, in document order. */
const FOCUSABLE = 'button:not([disabled]), textarea, input, a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Wraps Tab and Shift+Tab around the sheet's own focusable elements.
 *
 * `aria-modal` claims the rest of the page is inert, so Tab has to behave
 * that way too. Without this, Tab walks into the table behind the scrim —
 * which cannot be clicked, and from which Escape no longer reaches the sheet.
 */
export function trapTab(e: KeyboardEvent, panel: HTMLElement | null) {
  const stops = panel ? [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)] : [];
  if (stops.length === 0) return;

  const first = stops[0];
  const last = stops[stops.length - 1];
  const active = document.activeElement;
  // The panel itself holds focus until the user Tabs off it, so an unknown
  // active element means "at the start" rather than "somewhere in the middle".
  if (e.shiftKey ? active === first || !stops.includes(active as HTMLElement) : active === last) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  }
}
