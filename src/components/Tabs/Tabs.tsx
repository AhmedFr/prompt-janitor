import { useId, useRef, type KeyboardEvent } from "react";
import type { TabsProps } from "./Tabs.types";
import "./Tabs.css";

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

/**
 * Accessible tab strip: `role=tablist/tab/tabpanel`, arrow-key navigation
 * with automatic activation (moving focus selects the tab, per the WAI-ARIA
 * tabs pattern), Home/End to the ends. Fully controlled — the caller owns
 * `active`; see `useTabState` in this folder for a `sessionStorage`-backed
 * setter that remembers the choice across remounts.
 */
export function Tabs({ items, active, onChange, ariaLabel, children }: TabsProps) {
  const uid = useId();
  const tabEls = useRef<Record<string, HTMLButtonElement | null>>({});

  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === active),
  );

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
        selectAt((activeIndex + 1) % count);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectAt((activeIndex - 1 + count) % count);
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
          const selected = item.id === active;
          const tabId = `${uid}-tab-${item.id}`;
          const panelId = `${uid}-panel-${item.id}`;
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
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.id)}
              onKeyDown={onKeyDown}
            >
              {item.label}
              {item.count !== undefined && <span className="tabs__count tnum">{item.count}</span>}
            </button>
          );
        })}
      </div>

      <div
        className="tabs__panel"
        role="tabpanel"
        id={`${uid}-panel-${active}`}
        aria-labelledby={`${uid}-tab-${active}`}
        tabIndex={0}
      >
        {children(active)}
      </div>
    </div>
  );
}
