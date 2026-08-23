import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import type { TabsProps } from "./Tabs.types";
import "./Tabs.css";

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

/**
 * Accessible tab strip: `role=tablist/tab/tabpanel`, arrow-key navigation
 * with automatic activation (moving focus selects the tab, per the WAI-ARIA
 * tabs pattern), Home/End to the ends. Fully controlled — the caller owns
 * `active`; see `useTabState` in this folder for a `sessionStorage`-backed
 * setter that remembers the choice across remounts.
 *
 * `active` is trusted but verified: if it names a tab not in `items` (a
 * stale id from a parent's own state, a tab set that shrank), the strip
 * renders as if `items[0]` were active — selected, tabbable, panel wired up,
 * `children` called with a real id — rather than showing nothing selected.
 * An effect nudges the parent once via `onChange(items[0].id)` so its state
 * catches up instead of staying permanently out of sync with what's shown.
 */
export function Tabs({ items, active, onChange, ariaLabel, children }: TabsProps) {
  const uid = useId();
  const tabEls = useRef<Record<string, HTMLButtonElement | null>>({});

  // The tab set's *identity* changes on every render of a parent that maps its
  // data; its *contents* are what a correction depends on. Keyed on the ids so
  // a stale `active` is corrected once, not once per parent render.
  const itemIds = items.map((item) => item.id).join(" ");

  const activeIndex = items.findIndex((item) => item.id === active);
  const effectiveIndex = activeIndex === -1 ? 0 : activeIndex;
  const effectiveActive = items[effectiveIndex]?.id ?? active;

  useEffect(() => {
    if (items.length > 0 && !items.some((item) => item.id === active)) {
      onChange(items[0].id);
    }
    // `onChange` and `items` are intentionally excluded: only `active` and the
    // tab *ids* going out of sync should trigger the correction, not a parent
    // handing in a new (often inline, identity-unstable) function or a freshly
    // mapped array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, itemIds]);

  const selectAt = (index: number) => {
    const item = items[index];
    if (!item) return;
    onChange(item.id);
    tabEls.current[item.id]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const count = items.length;
    if (count === 0) return;
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        selectAt((effectiveIndex + 1) % count);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectAt((effectiveIndex - 1 + count) % count);
        break;
      case "Home":
        event.preventDefault();
        selectAt(0);
        break;
      case "End":
        event.preventDefault();
        selectAt(count - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div className="tabs">
      <div className="tabs__list" role="tablist" aria-label={ariaLabel}>
        {items.map((item) => {
          const selected = item.id === effectiveActive;
          const tabId = `${uid}-tab-${item.id}`;
          const panelId = `${uid}-panel-${item.id}`;
          // A tab may carry either form of badge; `countLabel` wins, because a
          // tab that spells out "12/20" has nothing to gain from also showing
          // the 20 it already contains.
          const badge = item.countLabel ?? (item.count !== undefined ? String(item.count) : null);
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabEls.current[item.id] = el;
              }}
              type="button"
              role="tab"
              id={tabId}
              className={cx("tabs__tab", selected && "tabs__tab--active")}
              // The badge sits inside the button, so without this its digits
              // run straight into the label and the tab announces as
              // "Rules12". Spelled out here, hidden below.
              aria-label={badge === null ? undefined : `${item.label}, ${badge}`}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.id)}
              onKeyDown={onKeyDown}
            >
              {item.label}
              {badge !== null && (
                <span className="tabs__count tnum" aria-hidden="true">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* No tabs, no panel: there would be no tab for `aria-labelledby` to
          name, and a panel labelled by a missing id is worse than none. The
          panel is not a tab stop either — what you tab to is the content in
          it, which owns its own focusables. */}
      {items.length > 0 && (
        <div
          className="tabs__panel"
          role="tabpanel"
          id={`${uid}-panel-${effectiveActive}`}
          aria-labelledby={`${uid}-tab-${effectiveActive}`}
        >
          {children(effectiveActive)}
        </div>
      )}
    </div>
  );
}
