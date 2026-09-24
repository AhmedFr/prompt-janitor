import { useEffect, useId, useRef } from "react";
import { Icon } from "@/components/Icon";
import { CLOSE_LABEL, FIND_LABEL, NEXT_LABEL, NO_MATCHES, PREVIOUS_LABEL } from "./FindBar.constants";
import type { FindBarProps } from "./FindBar.types";
import "./FindBar.css";

/**
 * The find strip, as every macOS text view has it: a field, "n of m", the
 * two arrows, a close. Enter and Shift+Enter move between matches, Escape
 * closes — and stops there, so the sheet behind does not close with it.
 *
 * Presentational: `useFind` owns the matches, this owns the keys and pixels.
 */
export function FindBar({ query, onQueryChange, count, current, onNext, onPrev, onClose, focusSignal = 0 }: FindBarProps) {
  const input = useRef<HTMLInputElement>(null);
  const statusId = useId();

  // Opening find is a request to type; ⌘F pressed while it is already open
  // re-selects the query, the way Safari and Xcode do.
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, [focusSignal]);

  const status = query.trim().length === 0 ? "" : count === 0 ? NO_MATCHES : `${current + 1} of ${count}`;

  return (
    <div className="find" role="search">
      <label className="find__field">
        <Icon name="search" size={12} className="find__icon" />
        <input
          ref={input}
          className="find__input"
          type="search"
          aria-label={FIND_LABEL}
          aria-describedby={statusId}
          placeholder={FIND_LABEL}
          value={query}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (e.shiftKey) onPrev();
              else onNext();
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
          }}
        />
      </label>
      <span id={statusId} className={`find__status${count === 0 && status ? " find__status--none" : ""}`} aria-live="polite">
        {status}
      </span>
      <button type="button" className="find__btn" aria-label={PREVIOUS_LABEL} disabled={count === 0} onClick={onPrev}>
        <Icon name="chevronUp" size={14} />
      </button>
      <button type="button" className="find__btn" aria-label={NEXT_LABEL} disabled={count === 0} onClick={onNext}>
        <Icon name="chevronDown" size={14} />
      </button>
      <span className="find__spacer" />
      <button type="button" className="find__btn" aria-label={CLOSE_LABEL} onClick={onClose}>
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}
