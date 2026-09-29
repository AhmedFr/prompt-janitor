import { TABLIST_LABEL, TABS } from "./ItemViewerTabs.constants";
import type { ItemViewerTabsProps } from "./ItemViewerTabs.types";

/** The viewer's three tabs (spec §6). Named "Viewer" so it never reads as the page's own tabs. */
export function ItemViewerTabs({ active, onChange, findingsCount, editing = false }: ItemViewerTabsProps) {
  return (
    <div className="iv-tabs" role="tablist" aria-label={TABLIST_LABEL}>
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          disabled={editing && id !== "content"}
          className={"iv-tab" + (active === id ? " iv-tab--on" : "")}
          onClick={() => onChange(id)}
        >
          {label}
          {id === "findings" && findingsCount ? <span className="iv-tab__count">{findingsCount}</span> : null}
        </button>
      ))}
    </div>
  );
}
