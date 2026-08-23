import { Icon } from "@/components/Icon";
import { ProjectGlyph } from "@/components/ProjectGlyph";
import type { SidebarProps } from "./Sidebar.types";
import { NAV_ITEMS, NAV_OWNER } from "./Sidebar.constants";
import { useSidebar } from "./useSidebar";

export function Sidebar({ active, onNavigate, onReplay }: SidebarProps) {
  const { projects, counts } = useSidebar();

  return (
    <aside className="sidebar">
      {/* Drag region; leaves room for the macOS traffic lights (overlay titlebar). */}
      <div className="sidebar__titlebar" data-tauri-drag-region />

      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden="true">
          <Icon name="logo" size={16} />
        </span>
        <span className="sidebar__name">Prompt Janitor</span>
      </div>

      <nav className="sidebar__nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const isActive = (NAV_OWNER[active] ?? active) === item.route;
          const count = counts[item.route];
          return (
            <button
              key={item.route}
              type="button"
              className={`sidebar__item${isActive ? " sidebar__item--active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onNavigate(item.route)}
            >
              <Icon name={item.icon} className="sidebar__item-icon" />
              <span className="sidebar__item-label">{item.label}</span>
              {count !== undefined && count > 0 && (
                <span className="sidebar__count">{count}</span>
              )}
            </button>
          );
        })}

        {projects.length > 0 && (
          <div className="sidebar__section">
            <p className="sidebar__section-label">Projects</p>
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                className="sidebar__item sidebar__item--project"
                // The project's own page, not the files table filtered to it:
                // the page answers the questions a recent project is opened
                // for (grade, load order, what ran here), and its Rules tab
                // holds the files anyway.
                onClick={() => onNavigate("project", project.id)}
              >
                <ProjectGlyph name={project.name} grade={project.grade} logo={project.logo} size={18} />
                <span className="sidebar__item-label">{project.name}</span>
                <span
                  className={`sidebar__grade sidebar__grade--${project.grade.toLowerCase()}`}
                  aria-label={`Grade ${project.grade}`}
                >
                  {project.grade}
                </span>
              </button>
            ))}
          </div>
        )}
      </nav>

      {onReplay && (
        <div className="sidebar__footer">
          <button type="button" className="sidebar__item" onClick={onReplay}>
            Replay setup
          </button>
        </div>
      )}
    </aside>
  );
}
