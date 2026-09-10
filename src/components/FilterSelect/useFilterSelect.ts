import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";

export interface UseFilterSelectOptions {
  /** Ids of the options currently on screen — the filtered list, not every option. */
  visibleIds: string[];
  multi: boolean;
  onToggle: (optionId: string) => void;
}

export interface UseFilterSelect {
  open: boolean;
  /** Index into `visibleIds` of the keyboard-active option, or -1 for none. */
  active: number;
  setActive: (index: number) => void;
  rootRef: RefObject<HTMLDivElement>;
  triggerRef: RefObject<HTMLButtonElement>;
  /** Flips the popover — what the trigger's own click does. */
  toggleOpen: () => void;
  /** Closes and puts focus back on the trigger: Escape, and a pick that ends the job. */
  close: () => void;
  /** Closes and leaves focus wherever it went — a click or a Tab out. */
  dismiss: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * Open state, roving activation and dismissal for `FilterSelect`, kept out of
 * the layout so neither file has to be read to change the other.
 *
 * Focus never enters the *list*: it sits on the combobox — the trigger, or the
 * option filter box when the popover has one — and the active option is
 * pointed at with `aria-activedescendant`. That is what lets one key handler on
 * the root serve both, and it is why Escape can hand focus back without having
 * to remember where it came from.
 *
 * The popover's own controls (the per-group `Clear`) are ordinary tab stops
 * inside the root. Dismissal is therefore driven by focus *leaving* the root
 * rather than by swallowing Tab: a Tab that lands on `Clear` has not left, and
 * a `Clear` a keyboard user could never reach would fail WCAG 2.1.1.
 */
export function useFilterSelect({ visibleIds, multi, onToggle }: UseFilterSelectOptions): UseFilterSelect {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const dismiss = useCallback(() => {
    setOpen(false);
    setActive(-1);
  }, []);

  const close = useCallback(() => {
    dismiss();
    triggerRef.current?.focus();
  }, [dismiss]);

  const toggleOpen = useCallback(() => {
    setOpen((wasOpen) => !wasOpen);
    // Opening by pointer activates nothing: the first ArrowDown should land on
    // the first option, not on the second.
    setActive(-1);
  }, []);

  // Pointer-down rather than click: a mousedown that starts outside should
  // dismiss even if the button it lands on swallows the click. No focus() —
  // the user is already on their way somewhere else.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      dismiss();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, dismiss]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const last = visibleIds.length - 1;
      // Only the combobox drives the list. A key pressed on a control inside
      // the popover (the `Clear` button) belongs to that control — swallowing
      // its Enter would leave it unoperable by keyboard.
      const onCombobox =
        event.target === triggerRef.current || event.target instanceof HTMLInputElement;
      const inTextField = event.target instanceof HTMLInputElement;

      if (!onCombobox) {
        if (event.key === "Escape") close();
        return;
      }

      if (!open) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setOpen(true);
          setActive(event.key === "ArrowDown" ? 0 : last);
        }
        return;
      }

      switch (event.key) {
        case "Escape":
          event.preventDefault();
          close();
          return;
        case "ArrowDown":
          event.preventDefault();
          setActive((current) => Math.min(current + 1, last));
          return;
        case "ArrowUp":
          event.preventDefault();
          setActive((current) => Math.max(current - 1, 0));
          return;
        case "Home":
        case "End":
          // In the filter box these are caret moves, and a query the user
          // cannot edit from the front is worse than a shortcut they lose.
          if (inTextField) return;
          event.preventDefault();
          setActive(event.key === "Home" ? 0 : last);
          return;
        case " ":
        case "Enter": {
          // Inside the filter box a space is a space. Everywhere else the
          // combobox is what has focus, and space picks.
          if (event.key === " " && inTextField) return;
          const id = visibleIds[active];
          // Prevented even with nothing active: the trigger is a button, and
          // letting the key through would re-open what it just closed.
          event.preventDefault();
          if (id === undefined) return;
          onToggle(id);
          if (!multi) close();
          return;
        }
        default:
          return;
      }
    },
    [active, close, multi, onToggle, open, visibleIds],
  );

  return { open, active, setActive, rootRef, triggerRef, toggleOpen, close, dismiss, onKeyDown };
}
