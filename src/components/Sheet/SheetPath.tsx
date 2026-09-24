import type { SheetPathProps } from "./Sheet.types";

/**
 * The file a sheet is showing, with the caller's actions for it at the end
 * of the row (reveal, open, copy — whatever the caller can back with a real
 * command). It carries none of its own: the "Open" it used to have handed the
 * path to the opener plugin's `openUrl`, which refuses file paths, so it did
 * nothing at all.
 */
export function SheetPath({ path, actions }: SheetPathProps) {
  return (
    <div className="sheet-path">
      {/* `bdi` keeps the path itself left-to-right inside the right-to-left
          box that truncates it from the left; without it the bidi algorithm
          moves the leading "/" to the end ("Users/a/.claude.json/"). */}
      <span className="sheet-path__text" title={path}>
        <bdi>{path}</bdi>
      </span>
      {actions && <div className="sheet-path__actions">{actions}</div>}
    </div>
  );
}
