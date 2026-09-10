import "./cells.css";
import type { NameCellProps } from "./cells.types";

/**
 * A row's name with its description muted beside it, both clamped to a single
 * line. A table is read by scanning down a column, and a description that
 * wraps turns every third row into a paragraph — so the description ellipsizes
 * and the whole string lives in `title` instead. The name gets its own floor
 * (`min-width` in `cells.css`) so a squeezed column can never reduce it to a
 * stub like "rkflow".
 */
export function NameCell({ name, description }: NameCellProps) {
  return (
    <span className="dt-name">
      <span className="dt-name__label" title={name}>
        {name}
      </span>
      {description && (
        <>
          {/* A real text node, not a CSS `::before`: it has to survive into
              `textContent`, or a screen reader (and a copy/paste) reads
              "adaptAdapts designs across screen sizes". Flex drops the
              surrounding whitespace and `.dt-name`'s gap spaces it instead. */}
          {" · "}
          <span className="dt-name__desc muted" title={description}>
            {description}
          </span>
        </>
      )}
    </span>
  );
}
