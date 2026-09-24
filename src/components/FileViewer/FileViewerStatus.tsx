import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { EMPTY_FILE, RETRY, SKELETON_LINES, errorTitle, readingLabel } from "./FileViewer.constants";

/**
 * A file-shaped placeholder: a gutter and ragged lines where the text will
 * be, so the sheet does not jump when the read lands.
 */
export function FileViewerLoading({ name }: { name: string }) {
  return (
    <div className="fv__state fv__loading" role="status" aria-busy="true">
      <span className="fv__state-label">{readingLabel(name)}</span>
      <div className="fv__skeleton" aria-hidden="true">
        {SKELETON_LINES.map((width, i) => (
          <div className="fv__skeleton-line" key={i}>
            <span className="fv__skeleton-num">{i + 1}</span>
            {width > 0 && <span className="fv__skeleton-bar" style={{ width: `${width}ch` }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/** What went wrong, verbatim from the backend, with the one thing to do about it. */
export function FileViewerError({ name, message, onRetry }: { name: string; message: string; onRetry?: () => void }) {
  return (
    <div className="fv__state fv__error" role="alert">
      <Icon name="alert" size={16} className="fv__error-icon" />
      <div className="fv__error-text">
        <p className="fv__error-title">{errorTitle(name)}</p>
        <p className="fv__error-message">{message}</p>
        {onRetry && (
          <Button size="sm" onClick={onRetry}>
            <Icon name="refresh" /> {RETRY}
          </Button>
        )}
      </div>
    </div>
  );
}

export function FileViewerEmpty() {
  return <p className="fv__state fv__empty muted">{EMPTY_FILE}</p>;
}
