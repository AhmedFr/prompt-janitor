import { useRef } from "react";
import { CodeView, languageFor } from "@/components/CodeView";
import { FindBar, useFind } from "@/components/FindBar";
import { SourceViewer } from "@/components/SourceViewer";
import { LANGUAGE_LABEL, PLAIN_TEXT, sourceLabel } from "./FileViewer.constants";
import type { FileViewerProps } from "./FileViewer.types";
import { FileViewerBar } from "./FileViewerBar";
import { FileViewerEmpty, FileViewerError, FileViewerLoading } from "./FileViewerStatus";
import { fileStats, modesFor } from "./fileViewer.util";
import { useFileViewer } from "./useFileViewer";
import "./FileViewer.css";

/**
 * A file, as a developer reads one: the text is the page. One bar on top —
 * Rendered / Source for markdown, the language for everything else, the
 * size, find, and the caller's actions — and below it the file, scrolling on
 * its own so the bar never leaves.
 *
 * Source is the file byte for byte, numbered and coloured; Rendered is a
 * convenience beside it, never a replacement, because a viewer that only
 * shows its interpretation hides exactly what the harness parses.
 */
export function FileViewer({
  name,
  content,
  format,
  path,
  loading,
  error,
  onRetry,
  actions,
  editor,
  emptyBody,
  initialMode,
}: FileViewerProps) {
  const body = useRef<HTMLDivElement>(null);
  const hasText = content !== null && content.trim().length > 0;
  const searchable = !editor && !loading && error === null && hasText;
  const viewer = useFileViewer(format, searchable, initialMode);
  const find = useFind(body, viewer.findOpen ? viewer.query : "", `${viewer.mode}\u0000${content ?? ""}`);

  const language = format ? languageFor(path, format) : null;
  const modes = format && !editor ? modesFor(format) : [];
  const ready = !loading && error === null && content !== null && format !== null;

  let main;
  if (editor) main = editor;
  else if (loading) main = <FileViewerLoading name={name} />;
  else if (error !== null) main = <FileViewerError name={name} message={error} onRetry={onRetry} />;
  else if (!ready || !hasText) main = <FileViewerEmpty />;
  else if (viewer.mode === "rendered")
    main = (
      <div className="fv__rendered">
        <SourceViewer content={content} format="markdown" emptyBody={emptyBody} />
      </div>
    );
  else main = <CodeView content={content} language={language} ariaLabel={sourceLabel(name)} />;

  // A failed read has no format, no size and nothing to find; an empty strip
  // above the error would be chrome for its own sake.
  const showBar = !(error !== null && format === null && !actions);

  return (
    <div className="fv">
      {showBar && (
        <FileViewerBar
          modes={modes}
          mode={viewer.mode}
          onMode={viewer.setMode}
          language={format === null ? null : language ? LANGUAGE_LABEL[language] : PLAIN_TEXT}
          stats={content !== null && !loading ? fileStats(content) : null}
          onFind={searchable ? viewer.openFind : undefined}
          actions={actions}
        />
      )}
      {searchable && viewer.findOpen && (
        <FindBar
          query={viewer.query}
          onQueryChange={viewer.setQuery}
          count={find.count}
          current={find.current}
          onNext={find.next}
          onPrev={find.prev}
          onClose={viewer.closeFind}
          focusSignal={viewer.findFocus}
        />
      )}
      <div className={editor ? "fv__body fv__body--editor" : "fv__body"} ref={body}>
        {main}
      </div>
    </div>
  );
}
