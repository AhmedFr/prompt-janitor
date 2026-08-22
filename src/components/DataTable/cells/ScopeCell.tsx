import "./cells.css";
import type { ScopeCellProps } from "./cells.types";

/** Where a row's artifact applies: the global layer, a plugin, or one project. */
export function ScopeCell({ layer, projectName }: ScopeCellProps) {
  const label = layer === "global" ? "Global" : layer === "plugin" ? "Plugin" : (projectName ?? "Project");
  return (
    <span className="dt-scope" data-layer={layer}>
      {label}
    </span>
  );
}
