import { useEffect, useId, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import type { FilterSelectProps } from "./FilterSelect.types";
import { useFilterSelect } from "./useFilterSelect";
import {
  CLEAR_LABEL,
  FILTER_PLACEHOLDER,
  NO_MATCH_LABEL,
  SEARCH_THRESHOLD,
  SELECTED_SUFFIX,
  VALUE_SEPARATOR,
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
 */
export function FilterSelect({ label, options, selected, multi, onToggle, onClear }: FilterSelectProps) {
  const uid = useId();
  const [query, setQuery] = useState("");

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

  const { open, active, setActive, rootRef, triggerRef, toggleOpen, close, onKeyDown } = useFilterSelect({
    visibleIds,
    multi,
    onToggle,
  });

  // A query the user has left behind is not a filter they would expect to come
  // back to — reopening a group should show all of it.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const listId = `${uid}list`;
  const optionId = (index: number) => `${uid}opt${index}`;
  const activeId = open && active >= 0 && active < visible.length ? optionId(active) : undefined;

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
    <div className="fs" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        ref={triggerRef}
        className="fs__trigger"
        data-active={chosen.length > 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={activeId}
        aria-label={spokenValue ? `${label}, ${spokenValue}` : label}
        onClick={toggleOpen}
      >
        {label}
        {value !== null && <span className="fs__value">{`${VALUE_SEPARATOR}${value}`}</span>}
        <Icon name="chevronDown" size={13} className="fs__caret" aria-hidden="true" />
      </button>

      {open && (
        <div className="fs__popover">
          {searchable && (
            <input
              type="search"
              className="fs__search"
              autoFocus
              value={query}
              placeholder={FILTER_PLACEHOLDER}
              aria-label={`${FILTER_PLACEHOLDER} ${label}`}
              aria-controls={listId}
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

          {visible.length === 0 && <p className="fs__empty">{NO_MATCH_LABEL}</p>}

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
