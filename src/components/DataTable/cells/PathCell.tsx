import "./cells.css";
import type { PathCellProps } from "./cells.types";
import { truncateMiddle } from "./cells.util";

/** Monospace path, shortened from the middle, with the whole path in `title`. */
export function PathCell({ path }: PathCellProps) {
  return (
    <span className="dt-path" title={path}>
      {truncateMiddle(path)}
    </span>
  );
}
