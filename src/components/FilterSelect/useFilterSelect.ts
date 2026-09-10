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
  /** Closes and puts focus back where the user left it. */
  close: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * Open state, roving activation and dismissal for `FilterSelect`, kept out of
 * the layout so neither file has to be read to change the other.
 *
 * Focus never enters the popover: it stays on the trigger, or on the option
 * filter box when the popover has one, and the active option is pointed at
 * with `aria-activedescendant`. That is what lets one key handler on the root
 * serve both — and it is why Escape can hand focus back without having to
 * remember where it came from.
 */
export function useFilterSelect({ visibleIds, multi, onToggle }: UseFilterSelectOptions): UseFilterSelect {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setActive(-1);
    triggerRef.current?.focus();
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen((wasOpen) => !wasOpen);
    // Opening by pointer activates nothing: the first ArrowDown should land on
    // the first option, not on the second.
    setActive(-1);
  }, []);

  // Pointer-down rather than click: a mousedown that starts outside should
  // dismiss even if the button it lands on swallows the click.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      // No focus() here — the user is already on their way somewhere else,
      // and yanking focus back to the trigger would fight them for it.
      setOpen(false);
      setActive(-1);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const last = visibleIds.length - 1;

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
        case "Tab":
          // Not prevented: Tab's job is to leave, and the popover only has to
          // get out of the way while it does.
          setOpen(false);
          setActive(-1);
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
          event.preventDefault();
          setActive(0);
          return;
        case "End":
          event.preventDefault();
          setActive(last);
          return;
        case " ":
        case "Enter": {
          // Inside the filter box a space is a space. Everywhere else the
          // popover is what has focus, and space picks.
          if (event.key === " " && event.target instanceof HTMLInputElement) return;
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

  return { open, active, setActive, rootRef, triggerRef, toggleOpen, close, onKeyDown };
}
