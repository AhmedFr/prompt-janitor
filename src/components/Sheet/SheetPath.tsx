import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { openExternal } from "@/lib/open-external";
import type { SheetPathProps } from "./Sheet.types";

/** The file a sheet is showing, with the one action every file has: open it. */
export function SheetPath({ path, name }: SheetPathProps) {
  return (
    <div className="sheet-path">
      {/* `bdi` keeps the path itself left-to-right inside the right-to-left
          box that truncates it from the left; without it the bidi algorithm
          moves the leading "/" to the end ("Users/a/.claude.json/"). */}
      <span className="sheet-path__text" title={path}>
        <bdi>{path}</bdi>
      </span>
      {/* "Open", not "Reveal": this is the opener plugin, the same call the
          table's own action makes, and it opens the file in the default app
          rather than selecting it in Finder. */}
      <Button size="sm" aria-label={`Open ${name} on disk`} onClick={() => void openExternal(path)}>
        <Icon name="folder" /> Open
      </Button>
    </div>
  );
}
