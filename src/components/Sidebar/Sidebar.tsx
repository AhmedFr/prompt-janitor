import type { SidebarProps } from "./Sidebar.types";
import { NAV_ITEMS } from "./Sidebar.constants";

export function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      {/* Drag region; leaves room for the macOS traffic lights (overlay titlebar). */}
      <div className="sidebar__titlebar" data-tauri-drag-region />

      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden="true">
          🧹
        </span>
        <span className="sidebar__name">Prompt Janitor</span>
      </div>

      <nav className="sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.route}
            type="button"
            className={`sidebar__item${active === item.route ? " sidebar__item--active" : ""}`}
            aria-current={active === item.route ? "page" : undefined}
            onClick={() => onNavigate(item.route)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
