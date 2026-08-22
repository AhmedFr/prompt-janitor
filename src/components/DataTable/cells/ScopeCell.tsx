import "./cells.css";
import type { ScopeCellProps } from "./cells.types";

/** Where a row's artifact comes from: the global layer, a named plugin, or one project. */
export function ScopeCell({ layer, projectName, pluginName }: ScopeCellProps) {
  const label =
    layer === "global"
      ? "Global"
      : layer === "plugin"
        ? (pluginName ?? "Plugin")
        : (projectName ?? "Project");
  return (
    <span className="dt-scope" data-layer={layer}>
      {label}
    </span>
  );
}
