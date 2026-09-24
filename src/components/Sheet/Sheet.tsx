import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import type { SheetProps } from "./Sheet.types";
import { trapTab } from "./sheet.util";
import "./Sheet.css";

/**
 * A drawer over the right edge of the window: header, scrollable body,
 * optional footer. The table stays visible down the left, so the sheet reads
 * as "this row, expanded" rather than as a separate place.
 *
 * Owns only the frame and its keyboard contract — focus in on open, back to
 * the opener on close, Tab kept inside, Escape and the backdrop routed to
 * `onClose`. What goes in the body is the caller's.
 */
export function Sheet({ title, ariaLabel, onClose, subtitle, toolbar, error, footer, overlay, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Whatever had focus when the sheet opened — the table row, in the app.
  const opener = useRef<HTMLElement | null>(null);

  // Focus moves in so Escape and Tab land here rather than in the table
  // behind, and goes back on close — otherwise it lands on `<body>` and a
  // keyboard user loses their place in a table they may have scrolled far.
  useEffect(() => {
    opener.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => opener.current?.focus();
  }, []);

  return (
    <div className="sheet-scrim" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        tabIndex={-1}
        // The scrim closes on a press that started on the scrim; without this
        // a drag that ends outside the panel (selecting text to the edge)
        // would close it mid-selection.
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
            return;
          }
          if (e.key === "Tab") trapTab(e, panelRef.current);
        }}
      >
        <header className="sheet__hd">
          <div className="sheet__id">
            <h2 className="sheet__title">{title}</h2>
            {subtitle && <div className="sheet__subtitle">{subtitle}</div>}
          </div>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="Close">
            <Icon name="x" size={15} />
          </button>
        </header>

        {toolbar && <div className="sheet__toolbar">{toolbar}</div>}

        <div className="sheet__body">{children}</div>

        {error && (
          <p className="sheet__error" role="alert">
            {error}
          </p>
        )}

        {footer && <footer className="sheet__ft">{footer}</footer>}

        {overlay}
      </div>
    </div>
  );
}
