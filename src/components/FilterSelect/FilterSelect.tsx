import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { Icon } from "@/components/Icon";
import type { FilterSelectProps } from "./FilterSelect.types";
import { useFilterSelect } from "./useFilterSelect";
import {
  CLEAR_LABEL,
  FILTER_PLACEHOLDER,
  NO_MATCH_LABEL,
  NO_OPTIONS_LABEL,
  SEARCH_THRESHOLD,
  SELECTED_SUFFIX,
  VALUE_SEPARATOR,
  VIEWPORT_MARGIN,
} from "./FilterSelect.constants";
import "./FilterSelect.css";

/**
 * One group of filter options behind a single control: a trigger that names
 * the group and whatever is picked, and a listbox popover with the options and
 * their faceted counts.
 *
 * It replaces a row of chips per group. A chip row spends horizontal space in
 * proportion to how many options exist — Setup's Scope group has one per
 * project and one per plugin — where this spends the same width whether the
 * group has three options or thirty, and only the group the user is actually
 * filtering by ever unfolds.
 *
 * **Which element is the combobox depends on whether the popover has a filter
 * box**, because `aria-activedescendant` is only honoured on the element that
 * actually has DOM focus — and is only a valid attribute on a combobox, never
 * on a plain button. A short group is the ARIA "select-only combobox": the
 * trigger is the combobox and keeps focus throughout. A long one moves focus
 * into the filter box, which becomes the combobox owning the list, and the
 * trigger drops back to a disclosure button.
 */
export function FilterSelect({ label, options, selected, multi, onToggle, onClear }: FilterSelectProps) {
  const uid = useId();
  const [query, setQuery] = useState("");
  const [alignRight, setAlignRight] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Only ids the options still offer count as a selection: a remembered filter
  // whose option has gone (a rescanned-away project) must not make the trigger
  // claim a slice the user cannot see or un-pick.
  const chosen = useMemo(
    () => options.filter((option) => selected.includes(option.id)),
    [options, selected],
  );

  const searchable = options.length > SEARCH_THRESHOLD;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  const visibleIds = useMemo(() => visible.map((option) => option.id), [visible]);

  const { open, active, setActive, rootRef, triggerRef, toggleOpen, close, dismiss, onKeyDown } =
    useFilterSelect({ visibleIds, multi, onToggle });

  const listId = `${uid}list`;
  const optionId = (index: number) => `${uid}opt${index}`;
  const activeId = open && active >= 0 && active < visible.length ? optionId(active) : undefined;

  // One place decides where focus goes when the popover opens, so the answer
  // can't drift between the two shapes. It has to be explicit: WebKit — the
  // engine Tauri ships on macOS — does not focus a `<button>` on click, so a
  // pointer-opened popover would otherwise ignore every key that follows.
  useEffect(() => {
    if (!open) return;
    (searchable ? searchRef.current : triggerRef.current)?.focus();
  }, [open, searchable, triggerRef]);

  // A query the user has left behind is not a filter they would expect to come
  // back to — reopening a group should show all of it.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // The rightmost group in a toolbar has no room to open leftwards. Measured
  // rather than guessed: how much room there is depends on the window, which
  // is resizable down to 720px.
  useLayoutEffect(() => {
    if (!open) {
      setAlignRight(false);
      return;
    }
    const rect = popoverRef.current?.getBoundingClientRect();
    if (!rect) return;
    // `window.innerWidth` rather than `documentElement.clientWidth`: the
    // webview paints overlay scrollbars, so the two agree, and only the
    // former is populated under jsdom for the test to stage.
    setAlignRight(rect.right > window.innerWidth - VIEWPORT_MARGIN);
  }, [open]);

  // Keeps the walked-to option on screen: the list scrolls past nine rows, and
  // an active row below the fold leaves a keyboard user navigating blind.
  // Guarded because jsdom has no `scrollIntoView`.
  useEffect(() => {
    if (!activeId) return;
    const el = document.getElementById(activeId);
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  // The popover's controls are ordinary tab stops, so what ends the session is
  // focus leaving the whole control — not Tab itself. See `useFilterSelect`.
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && rootRef.current?.contains(next)) return;
    dismiss();
  };

  // The name is spelled out where the visible text is abbreviated: "Scope · 2"
  // reads as "Scope, 2 selected", and the count never runs into the label.
  const value = chosen.length === 0 ? null : chosen.length === 1 ? chosen[0].label : String(chosen.length);
  const spokenValue =
    chosen.length === 0 ? null : chosen.length === 1 ? chosen[0].label : `${chosen.length} ${SELECTED_SUFFIX}`;

  const pick = (index: number) => {
    const option = visible[index];
    if (!option) return;
    setActive(index);
    onToggle(option.id);
    if (!multi) close();
  };

  return (
    <div className="fs" ref={rootRef} onKeyDown={onKeyDown} onBlur={onBlur}>
      <button
        type="button"
        ref={triggerRef}
        className="fs__trigger"
        data-active={chosen.length > 0}
        // Only when this element is the one holding focus and the pointer —
        // otherwise the filter box below is the combobox and this is a plain
        // disclosure button.
        role={searchable ? undefined : "combobox"}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={searchable ? undefined : activeId}
        aria-label={spokenValue ? `${label}, ${spokenValue}` : label}
        onClick={toggleOpen}
      >
        {label}
        {value !== null && <span className="fs__value">{`${VALUE_SEPARATOR}${value}`}</span>}
        <Icon name="chevronDown" size={13} className="fs__caret" aria-hidden="true" />
      </button>

      {open && (
        <div className="fs__popover" ref={popoverRef} data-align={alignRight ? "right" : "left"}>
          {searchable && (
            <input
              type="text"
              ref={searchRef}
              className="fs__search"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeId}
              value={query}
              placeholder={FILTER_PLACEHOLDER}
              aria-label={`${FILTER_PLACEHOLDER} ${label}`}
              onChange={(event) => {
                setQuery(event.target.value);
                // The list under the cursor is a different list now; keeping
                // the old index would activate a row the user never saw.
                setActive(-1);
              }}
            />
          )}

          <ul
            className="fs__list"
            id={listId}
            role="listbox"
            aria-label={label}
            aria-multiselectable={multi || undefined}
          >
            {visible.map((option, index) => {
              const on = selected.includes(option.id);
              return (
                <li
                  key={option.id}
                  id={optionId(index)}
                  role="option"
                  className="fs__option"
                  data-active={index === active}
                  aria-selected={on}
                  // Spelled apart for the same reason the trigger is: without
                  // it the row announces as "Global41".
                  aria-label={`${option.label}, ${option.count}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(index)}
                >
                  <span className="fs__check" aria-hidden="true">
                    {on && <Icon name="check" size={12} />}
                  </span>
                  <span className="fs__label">{option.label}</span>
                  <span className="fs__count" aria-hidden="true">
                    {option.count}
                  </span>
                </li>
              );
            })}
          </ul>

          {/* Announced, not just drawn: the list shrinking under a query the
              user is typing is the whole feedback the filter box gives. */}
          {visible.length === 0 && (
            <p className="fs__empty" role="status">
              {options.length === 0 ? NO_OPTIONS_LABEL : NO_MATCH_LABEL}
            </p>
          )}

          {chosen.length > 0 && (
            <button
              type="button"
              className="fs__clear"
              onClick={() => {
                onClear();
                close();
              }}
            >
              {CLEAR_LABEL}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
