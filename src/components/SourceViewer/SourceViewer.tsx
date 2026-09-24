import { memo } from "react";
import { Markdown } from "@/components/Markdown";
import { EMPTY_BODY, EMPTY_FILE } from "./SourceViewer.constants";
import type { SourceViewerProps } from "./SourceViewer.types";
import { splitFrontmatter } from "./sourceViewer.util";
import "./SourceViewer.css";

/**
 * A file, drawn for reading. Markdown gets its header as a key/value strip
 * and its body rendered; JSON and plain text are shown verbatim, because a
 * config file reformatted by a viewer is no longer the file the harness reads.
 *
 * Memoised so a keystroke in the viewer's find bar does not re-parse the file.
 */
export const SourceViewer = memo(function SourceViewer({ content, format, emptyBody = EMPTY_BODY }: SourceViewerProps) {
  if (content.trim().length === 0) return <p className="muted sv__empty">{EMPTY_FILE}</p>;

  if (format !== "markdown") {
    return (
      <pre className="sv__code" data-format={format}>
        {content}
      </pre>
    );
  }

  const { fields, body } = splitFrontmatter(content);
  return (
    <>
      {fields.length > 0 && (
        <dl className="sv__meta">
          {fields.map(([key, value]) => (
            <div className="sv__meta-row" key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {body.trim().length > 0 ? <Markdown source={body} /> : <p className="muted sv__empty">{emptyBody}</p>}
    </>
  );
});
